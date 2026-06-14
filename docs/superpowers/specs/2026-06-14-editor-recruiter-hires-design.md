# Design: Video Editor + Recruiter roles & Hire pipeline

**Date:** 2026-06-14
**Status:** Approved (verbal)
**Author:** Pradhyuman + Claude

## Context

`creator-tracker-v4.jsx` is a deployed Vite/React SPA backed by Supabase (Auth +
Postgres + Realtime). It currently supports three roles — **Creator, Setter, Admin** —
with multi-role profiles (`profiles.is_admin/creator_id/setter_id`), admin-assigns-roles
via `pending_invites` + a signup trigger, realtime sync, and admin notification toasts.

Pavle built a standalone prototype (`TeamTracker`) that adds **Video Editor** and
**Recruiter** roles plus a **hire pipeline**, but stores data in a sandbox
`window.storage` KV and identifies users via a name-dropdown — neither exists in
production. This spec re-grounds those features on the real Supabase + Auth + admin stack.

## Goal

Port all three prototype features into production, matching existing patterns exactly:
1. **Video Editor** role — log edited videos with metrics; own dashboard + admin views.
2. **Recruiter** role — daily EOD per platform; own dashboard + admin views.
3. **Hire pipeline** — recruiter-managed candidate list; admin sees all.

Identity & data follow the production model: Supabase-backed entities, admin-assigned
roles, no self-serve. Discard `window.storage` and `window.name`.

## Non-goals (YAGNI)

- No automated Google-Drive folder verification of editor video counts (manual honest count).
- No refactor of the existing single-file architecture or existing Creator/Setter code.
- No new test framework (project has none; verify via `vite build` + adversarial review).
- No tightening of the existing permissive RLS posture (new tables match current model).

## Architecture

Mirror existing patterns 1:1. Editors/Recruiters become first-class entities like
Creators/Setters. Rejected alternatives: (a) unifying all roles into one `members` table
(risky migration of live data, dashboard rewrite); (b) piggybacking editors on `creators`
(pollutes leaderboards).

### Data model (new tables in `supabase/schema.sql`, additive + idempotent)

| Table | Mirrors | Columns |
|---|---|---|
| `editors` | `creators` | id, name, added_at, created_at |
| `recruiters` | `setters` | id, name, added_at, created_at |
| `edits` | `videos` | id, editor_id->editors, url, type, edited_for, time_raw, time_min, count, edit_date, last_updated, created_at |
| `recruit_reports` | `eod_reports` | id, recruiter_id->recruiters, date, platforms(jsonb), notes, submitted_at, last_updated, **unique(recruiter_id,date)** |
| `hires` | (new) | id, recruiter_id->recruiters, name, role(text), email, phone, status, details, hire_date, created_at, last_updated |

Schema also: `profiles` += `editor_id`, `recruiter_id`; `pending_invites` += same two;
extend `handle_new_user()` to consume them; grants/RLS (permissive `using(true)` to
anon+authenticated, matching existing tables); indexes (FK + date); add all 5 tables to
the `supabase_realtime` publication.

**Decision — recruiter EOD model:** one row per (recruiter, date) with all platforms in a
`platforms` jsonb (mirrors Setter EOD), upserted on resubmit — NOT the prototype's
one-row-per-platform. Per-platform analysis reads from the jsonb. Approved by user.

`recruit_reports.platforms` shape: `{ Discord: {groups, applications, onboarded, firstVideo, reposters}, ... }`.

### Data layer (`src/supabase.js`)

Extend `loadAll()` to also fetch + map editors, recruiters, edits (-> editsMap keyed by
editor_id), recruit_reports (-> recruitMap keyed by recruiter_id), hires (-> hiresMap keyed
by recruiter_id). New methods, all using existing `appToRow`/`rowToApp`/`must`:
- `addEditor/removeEditor`, `saveEdit/deleteEdit`
- `addRecruiter/removeRecruiter`, `saveRecruitEOD` (upsert on `recruiter_id,date`)
- `saveHire/updateHire/deleteHire`
- Extend `assignByEmail`, `createInvite`, `updateProfile` to carry `editorId`/`recruiterId`.
- Extend `subscribeAll` with editors, recruiters, edits, recruit_reports, hires.

### Frontend (`creator-tracker-v4.jsx`)

- `col` gains `magenta: "#ff5db1"` (editor) + `cyan: "#22d3ee"` (recruiter).
- Helpers: `timeToMin(str)` + `minToStr(min)` for editor time parsing (from prototype).
- New constants: `EDIT_TYPES`, `EDIT_FOR`, `RECRUIT_PLATFORMS`, `HIRE_STATUSES`.
- New user dashboards: `EditorDash`, `EditorForm`, `RecruiterDash`, `RecruiterEODForm`,
  `HirePipeline` + `HireCard` — reusing `TrendBars`/`Funnel`/`Podium`/`Sparkline`/`FilterChip`.
- New admin views: `AdminEditorsView`, `AdminEditorDetail`, `AdminRecruitersView`,
  `AdminRecruiterDetail`, and `AdminHireList` (all-hires list embedded in the Recruiters
  admin tab + recruiter detail, with per-hire recruiter attribution) — mirroring the
  Creator/Setter equivalents.
- App wiring: new state + load + realtime handlers; `myEditor`/`myRecruiter`;
  `availableRoles` + active-role auto-pick + `RoleSwitcher` gain editor/recruiter;
  render branches for the two dashboards + admin detail pages.
- `AdminDash`: new tabs Editors / Recruiters; pass editors/recruiters/editsMap/recruitMap/hires.
- `RoleAssignmentFields`: add Editor + Recruiter checkboxes (auto-create entity on check,
  `onAddEditor`/`onAddRecruiter`); `resolve()` returns editorId/recruiterId.
- `InviteForm`, `UserRow`, `AdminUsersView.rolesOf`: thread the two new roles.

### Domain enums (from prototype; user confirmed)

- Edit types: **Talking Head / Skit / Showcase**
- Edited for: **Clients / OutScript**
- Recruiter platforms: **Discord / Facebook / School Community / Other**
- Hire statuses: **Trial / Hired / Dropped**

## Editor metrics (per prototype)

Each `edit` row: a link (single video or a folder representing `count` videos), type,
edited-for, free-form time (`"45m"`, `"1.5h"` -> `time_min`), date. Editor overview:
videos edited (sum of count), time spent, avg/video, Clients vs OutScript split, by-type
bars, 14d/30d trend. Admin: team totals, by-type, leaderboard (sum count, time), detail page.

## Recruiter metrics (per prototype)

Daily EOD fields per platform: groups posted, applications, onboarded, posted-1st-video,
active reposters. Overview: 30d totals, recruiting funnel (groups->apps->onboarded->1st-video),
best-performing-platform (ranked by onboards-per-group), trend. Admin: team totals, funnel,
platform comparison, leaderboard, detail page. Hire stats (Trial/Hired counts) surface on
the recruiter overview too.

## Deployment / manual step

The new SQL must be run once in Supabase -> SQL Editor (idempotent, safe to re-run), same
as the original `schema.sql`. No env changes. Standard `vite build` deploy after.

## Verification

1. `npm run build` (vite) compiles clean.
2. Adversarial multi-agent review: schema/RLS safety, React hook/render correctness,
   data-layer consistency, design-system consistency, completeness vs. this spec.
3. Manual smoke per role once SQL is applied.

## Known follow-ups (not in this change)

- `creator-tracker-v4.jsx` will exceed ~4000 lines; consider splitting role dashboards
  into modules later (separate task).
- App-wide RLS is permissive; tightening to per-user policies is a separate hardening pass.
