-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Partner Selections migration
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (uses IF NOT EXISTS / drop-then-create like schema.sql).
--
-- Adds:
--   1) public.is_partner_email(text)   — anon-callable gate for the login
--   2) public.partner_selections table — a partner's chosen pieces
--   3) RLS so a partner can insert/read only their OWN selection, and the
--      admin (Sofia) can read/update everything.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) LOGIN GATE — is this email a known partner?
--    security definer so it can read partners past RLS; granted to anon
--    so PartnerLogin can check BEFORE sending a magic link (and reject
--    non-partners cleanly, without ever creating an auth user).
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_partner_email(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partners
    where lower(email) = lower(trim(check_email))
  );
$$;

grant execute on function public.is_partner_email(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) PARTNER SELECTIONS — pieces a partner chose from the live catalog
-- ─────────────────────────────────────────────────────────────
create table if not exists public.partner_selections (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid references public.partners(id) on delete set null,
  partner_email text not null,
  partner_name  text,
  items         jsonb not null default '[]'::jsonb,  -- [{product_id,title,variant_id,color,price,image}]
  note          text,                                 -- optional sizes / preferences
  status        text not null default 'new'
                  check (status in ('new','reviewed')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_partner_selections_email
  on public.partner_selections(lower(partner_email));
create index if not exists idx_partner_selections_status
  on public.partner_selections(status);

-- ─────────────────────────────────────────────────────────────
-- 3) ROW LEVEL SECURITY
--    Reuses the public.is_admin() and public.current_email() helpers
--    already defined in schema.sql.
-- ─────────────────────────────────────────────────────────────
alter table public.partner_selections enable row level security;

-- Admin (Sofia) — full read/write.
drop policy if exists selections_admin_all on public.partner_selections;
create policy selections_admin_all on public.partner_selections
  for all using (public.is_admin()) with check (public.is_admin());

-- Partner — may read only their own submissions.
drop policy if exists selections_self_select on public.partner_selections;
create policy selections_self_select on public.partner_selections
  for select using (lower(partner_email) = public.current_email());

-- Partner — may insert only a selection stamped with THEIR OWN email.
drop policy if exists selections_self_insert on public.partner_selections;
create policy selections_self_insert on public.partner_selections
  for insert with check (lower(partner_email) = public.current_email());

-- (No partner update/delete policy: once submitted, only the admin can
--  change status 'new' -> 'reviewed'. That's covered by selections_admin_all.)
