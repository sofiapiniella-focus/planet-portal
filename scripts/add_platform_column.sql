-- ════════════════════════════════════════════════════════════════════
-- Migration: add `platform` to partners  (Impact | GoAffPro)
--
-- HOW TO RUN (one time):
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--   Safe to re-run (IF NOT EXISTS + idempotent constraint add).
--
-- WHY a migration file: adding a column is DDL, which the service-role key
-- used by scripts/sync_partners.mjs cannot do over the API. Run this once
-- here; afterwards `npm run sync:partners` populates the values.
--
-- The NOT NULL default backfills every existing partner to 'GoAffPro'
-- immediately, so the dashboard badge/filter work the moment this runs.
-- ════════════════════════════════════════════════════════════════════

alter table public.partners
  add column if not exists platform text not null default 'GoAffPro';

-- Constraint added separately so a re-run doesn't error if the column
-- already exists from a prior run.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'partners_platform_check'
  ) then
    alter table public.partners
      add constraint partners_platform_check
      check (platform in ('Impact','GoAffPro'));
  end if;
end $$;
