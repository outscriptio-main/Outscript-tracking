-- ============================================================================
-- LocaScale Tracker · Supabase schema
-- ============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement uses IF NOT EXISTS or CREATE OR REPLACE.
-- ============================================================================

-- Required extension for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists creators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  added_at    date not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists setters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  added_at    date not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists videos (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references creators(id) on delete cascade,
  url           text not null,
  platform      text not null,
  views         integer not null default 0,
  posted_date   date not null,
  last_updated  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists eod_reports (
  id            uuid primary key default gen_random_uuid(),
  setter_id     uuid not null references setters(id) on delete cascade,
  date          date not null,
  platforms     jsonb not null default '{}'::jsonb,
  notes         text,
  submitted_at  timestamptz not null default now(),
  last_updated  timestamptz not null default now(),
  unique (setter_id, date)
);

create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  setter_id     uuid not null references setters(id) on delete cascade,
  name          text,
  profile_url   text,
  platform      text,
  status        text not null default 'new',
  email         text,
  phone         text,
  notes         text,
  created_at    timestamptz not null default now(),
  last_touch    timestamptz not null default now()
);

-- ============================================================================
-- INDEXES (built for the dashboard queries — 30d filters, leaderboards, drill-ins)
-- ============================================================================

create index if not exists videos_creator_id_idx       on videos(creator_id);
create index if not exists videos_posted_date_idx      on videos(posted_date desc);
create index if not exists videos_creator_posted_idx   on videos(creator_id, posted_date desc);

create index if not exists eod_setter_id_idx           on eod_reports(setter_id);
create index if not exists eod_date_idx                on eod_reports(date desc);
create index if not exists eod_setter_date_idx         on eod_reports(setter_id, date desc);

create index if not exists leads_setter_id_idx         on leads(setter_id);
create index if not exists leads_status_idx            on leads(status);
create index if not exists leads_last_touch_idx        on leads(last_touch desc);

-- ============================================================================
-- TABLE GRANTS
-- ============================================================================
-- Postgres checks GRANT permissions BEFORE RLS policies. Without these,
-- the anon role gets "permission denied for table ..." even with permissive
-- RLS in place. This is required for the new sb_publishable_* keys.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on creators    to anon, authenticated;
grant select, insert, update, delete on setters     to anon, authenticated;
grant select, insert, update, delete on videos      to anon, authenticated;
grant select, insert, update, delete on eod_reports to anon, authenticated;
grant select, insert, update, delete on leads       to anon, authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Permissive for now — matches the current "name-dropdown" auth model where
-- there's no real per-user identity. Once Supabase Auth is wired up, replace
-- these with policies keyed on auth.uid() and a role claim.
-- ============================================================================

alter table creators     enable row level security;
alter table setters      enable row level security;
alter table videos       enable row level security;
alter table eod_reports  enable row level security;
alter table leads        enable row level security;

-- Drop any prior copies of these policies so re-runs don't error
drop policy if exists "anon_all_creators"    on creators;
drop policy if exists "anon_all_setters"     on setters;
drop policy if exists "anon_all_videos"      on videos;
drop policy if exists "anon_all_eod_reports" on eod_reports;
drop policy if exists "anon_all_leads"       on leads;

create policy "anon_all_creators"    on creators    for all to anon, authenticated using (true) with check (true);
create policy "anon_all_setters"     on setters     for all to anon, authenticated using (true) with check (true);
create policy "anon_all_videos"      on videos      for all to anon, authenticated using (true) with check (true);
create policy "anon_all_eod_reports" on eod_reports for all to anon, authenticated using (true) with check (true);
create policy "anon_all_leads"       on leads       for all to anon, authenticated using (true) with check (true);

-- ============================================================================
-- AUTH: profiles table + signup trigger
-- ============================================================================
-- Each Supabase auth.users row gets a matching profiles row via trigger.
-- The profile carries:
--   - role: 'creator' | 'setter' | 'admin' | null (null = unassigned)
--   - creator_id / setter_id: link to the entity row (when role is set)
-- ============================================================================

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  is_admin    boolean not null default false,
  creator_id  uuid references creators(id) on delete set null,
  setter_id   uuid references setters(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Migrate from older single-role schema to multi-role:
--   - Add `is_admin` if upgrading
--   - Add `name` if upgrading
--   - Backfill `is_admin` from the old `role` column
--   - Drop the old `role` column
alter table profiles add column if not exists name text;
alter table profiles add column if not exists is_admin boolean not null default false;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    update profiles set is_admin = true where role = 'admin';
    -- Drop the policy + index that referenced `role`
    drop index if exists profiles_role_idx;
    alter table profiles drop column role;
  end if;
end$$;

-- Pre-invites: admin can pre-assign roles by email. When that user signs up
-- (Google or password), the trigger consumes the invite and applies the role.
create table if not exists pending_invites (
  email       text primary key,
  is_admin    boolean not null default false,
  creator_id  uuid references creators(id) on delete set null,
  setter_id   uuid references setters(id) on delete set null,
  invited_at  timestamptz not null default now()
);

alter table pending_invites add column if not exists is_admin boolean not null default false;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pending_invites' and column_name = 'role'
  ) then
    update pending_invites set is_admin = true where role = 'admin';
    alter table pending_invites drop column role;
  end if;
end$$;

create index if not exists pending_invites_email_idx on pending_invites(lower(email));

-- Trigger: auto-create a profile row when a user signs up. Pulls display
-- name from OAuth metadata when present (Google gives `name` + `full_name`),
-- and consumes any pre-invite matching the email.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  display_name text;
begin
  -- Read the matching pre-invite (case-insensitive on email)
  select is_admin, creator_id, setter_id into inv
  from public.pending_invites
  where lower(email) = lower(new.email);

  -- Compose display name from OAuth metadata, falling back to email handle
  display_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'preferred_username',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, name, is_admin, creator_id, setter_id)
  values (new.id, new.email, display_name, coalesce(inv.is_admin, false), inv.creator_id, inv.setter_id)
  on conflict (id) do nothing;

  -- Consume the invite (one-shot)
  delete from public.pending_invites where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: is the current request from an admin? (security definer => bypasses RLS,
-- avoids the policies-checking-themselves recursion trap).
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Grants for profiles
grant select, update on profiles to authenticated;
grant select on profiles to anon;
grant execute on function is_admin() to anon, authenticated;

-- Grants + RLS for pending_invites (admin-only)
grant select, insert, update, delete on pending_invites to authenticated;

alter table pending_invites enable row level security;
drop policy if exists "invites_admin_only" on pending_invites;
create policy "invites_admin_only" on pending_invites
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- RLS on profiles
alter table profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on profiles;
drop policy if exists "profiles_update_admin"       on profiles;

create policy "profiles_select_own_or_admin" on profiles
  for select to authenticated
  using (id = auth.uid() or is_admin());

create policy "profiles_update_admin" on profiles
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- One-time backfill: pull `name` from auth metadata for existing profiles
update profiles p
set name = coalesce(
  (select au.raw_user_meta_data->>'name'      from auth.users au where au.id = p.id),
  (select au.raw_user_meta_data->>'full_name' from auth.users au where au.id = p.id),
  split_part(p.email, '@', 1)
)
where p.name is null;

-- ============================================================================
-- REALTIME (so admin sees setter EOD submissions live)
-- ============================================================================

do $$
begin
  -- These ALTERs error if a table is already in the publication; wrap in DO.
  begin alter publication supabase_realtime add table creators;    exception when others then null; end;
  begin alter publication supabase_realtime add table setters;     exception when others then null; end;
  begin alter publication supabase_realtime add table videos;      exception when others then null; end;
  begin alter publication supabase_realtime add table eod_reports; exception when others then null; end;
  begin alter publication supabase_realtime add table leads;       exception when others then null; end;
  begin alter publication supabase_realtime add table profiles;    exception when others then null; end;
end$$;

-- ============================================================================
-- OPTIONAL: aggregate views for future server-side leaderboard queries
-- ============================================================================
-- Uncomment if/when you outgrow client-side aggregation (~10k+ rows).

-- create or replace view creator_stats_30d as
-- select c.id, c.name,
--        count(v.id)::int as videos_30d,
--        coalesce(sum(v.views), 0)::bigint as views_30d
-- from creators c
-- left join videos v
--   on v.creator_id = c.id and v.posted_date >= current_date - interval '30 days'
-- group by c.id, c.name;

-- create or replace view setter_stats_30d as
-- select s.id, s.name,
--        coalesce(sum((p.value->>'newMessages')::int), 0)     as new_messages,
--        coalesce(sum((p.value->>'positiveReplies')::int), 0) as positive_replies,
--        coalesce(sum((p.value->>'callsBooked')::int), 0)     as calls_booked,
--        coalesce(sum((p.value->>'freeTrials')::int), 0)      as free_trials
-- from setters s
-- left join eod_reports e on e.setter_id = s.id and e.date >= current_date - interval '30 days'
-- left join lateral jsonb_each(e.platforms) p on true
-- group by s.id, s.name;
