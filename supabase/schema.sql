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

create policy "anon_all_creators"    on creators    for all using (true) with check (true);
create policy "anon_all_setters"     on setters     for all using (true) with check (true);
create policy "anon_all_videos"      on videos      for all using (true) with check (true);
create policy "anon_all_eod_reports" on eod_reports for all using (true) with check (true);
create policy "anon_all_leads"       on leads       for all using (true) with check (true);

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
