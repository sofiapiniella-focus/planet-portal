-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE where possible).
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────

-- Partners (affiliate creators)
create table if not exists public.partners (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null unique,
  instagram       text,
  status          text not null default 'Contacted'
                    check (status in ('Contacted','Interested','Active Partner','Passed')),
  platform        text not null default 'GoAffPro'      -- affiliate platform the partner runs through
                    check (platform in ('Impact','GoAffPro')),
  commission_link text,
  partner_message text,                 -- partner's note left for the admin (Lauren)
  created_at      timestamptz not null default now()
);

-- Kits (one current kit per partner; supports multiple over time)
create table if not exists public.kits (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  status          text not null default 'Preparing'
                    check (status in ('Preparing','Shipped','Delivered','Return Pending','Returned')),
  ship_date       date,
  tracking_number text,
  return_by_date  date,
  notes           text,                 -- admin's internal notes about the kit
  created_at      timestamptz not null default now()
);

-- Kit pieces (individual items in a kit)
create table if not exists public.kit_pieces (
  id               uuid primary key default gen_random_uuid(),
  kit_id           uuid not null references public.kits(id) on delete cascade,
  piece_name       text not null,
  color            text,
  photo_url        text,
  partner_decision text check (partner_decision in ('Keep','Return')),  -- null = undecided
  purchase_amount  numeric,                                             -- USD a stylist paid for a kept piece; null = unset
  created_at       timestamptz not null default now()
);

-- Content log (what each partner has posted)
create table if not exists public.content_log (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  content_type text not null
                 check (content_type in ('Reel','Feed Post','Story','Blog Post')),
  post_date    date,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Admins (which auth users are allowed into the internal dashboard)
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_kits_partner on public.kits(partner_id);
create index if not exists idx_pieces_kit on public.kit_pieces(kit_id);
create index if not exists idx_content_partner on public.content_log(partner_id);
create index if not exists idx_partners_email on public.partners(lower(email));

-- ─────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- True if the current authenticated user is an admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- The email of the current authenticated user (lower-cased), or null.
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- ─────────────────────────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
alter table public.partners    enable row level security;
alter table public.kits        enable row level security;
alter table public.kit_pieces  enable row level security;
alter table public.content_log enable row level security;
alter table public.admins      enable row level security;

-- ─────────────────────────────────────────────────────────────
-- POLICIES — drop-then-create so the script is idempotent
-- ─────────────────────────────────────────────────────────────

-- PARTNERS ----------------------------------------------------------
drop policy if exists partners_admin_all on public.partners;
create policy partners_admin_all on public.partners
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists partners_self_select on public.partners;
create policy partners_self_select on public.partners
  for select using (lower(email) = public.current_email());

-- A partner may update only their own row (used for partner_message).
drop policy if exists partners_self_update on public.partners;
create policy partners_self_update on public.partners
  for update using (lower(email) = public.current_email())
  with check (lower(email) = public.current_email());

-- KITS --------------------------------------------------------------
drop policy if exists kits_admin_all on public.kits;
create policy kits_admin_all on public.kits
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists kits_self_select on public.kits;
create policy kits_self_select on public.kits
  for select using (
    partner_id in (select id from public.partners where lower(email) = public.current_email())
  );

-- KIT PIECES --------------------------------------------------------
drop policy if exists pieces_admin_all on public.kit_pieces;
create policy pieces_admin_all on public.kit_pieces
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pieces_self_select on public.kit_pieces;
create policy pieces_self_select on public.kit_pieces
  for select using (
    kit_id in (
      select k.id from public.kits k
      join public.partners p on p.id = k.partner_id
      where lower(p.email) = public.current_email()
    )
  );

-- A partner may update only their own pieces (the Keep / Return decision).
drop policy if exists pieces_self_update on public.kit_pieces;
create policy pieces_self_update on public.kit_pieces
  for update using (
    kit_id in (
      select k.id from public.kits k
      join public.partners p on p.id = k.partner_id
      where lower(p.email) = public.current_email()
    )
  ) with check (
    kit_id in (
      select k.id from public.kits k
      join public.partners p on p.id = k.partner_id
      where lower(p.email) = public.current_email()
    )
  );

-- CONTENT LOG -------------------------------------------------------
drop policy if exists content_admin_all on public.content_log;
create policy content_admin_all on public.content_log
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists content_self_select on public.content_log;
create policy content_self_select on public.content_log
  for select using (
    partner_id in (select id from public.partners where lower(email) = public.current_email())
  );

-- ADMINS ------------------------------------------------------------
-- Authenticated users may check whether they themselves are an admin.
drop policy if exists admins_self_select on public.admins;
create policy admins_self_select on public.admins
  for select using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCRIPT:
--
-- 1) Create your admin login:
--      Supabase → Authentication → Users → "Add user"
--      Enter your email + a password (this is your admin password).
--      Check "Auto Confirm User".
--
-- 2) Mark that user as an admin. Run this (replace the email):
--      insert into public.admins (user_id)
--      select id from auth.users where email = 'you@example.com'
--      on conflict do nothing;
--
-- 3) Add partners from the Internal Dashboard, OR seed one for testing:
--      insert into public.partners (name, email, status, commission_link)
--      values ('Test Partner', 'partner@example.com', 'Active Partner',
--              'https://yourstore.com/?ref=testpartner');
--
-- 4) (Optional) seed a kit + pieces for that partner — see seed.sql.
-- ════════════════════════════════════════════════════════════════════
