# PLANET Style Collective Portal

An elevated, minimal portal for **PLANET by Lauren G** with two sides:

- **Affiliate Partner Portal** — partners sign in with their email (secure magic link) to see their welcome, commission link, commission earnings (GoAffPro), kit status, kit pieces (with Keep / Return), and a note field for you.
- **Internal Dashboard** — password-protected, for you only: manage partners, a kit tracker, and a content tracker.

Built with **React (Vite)**, **Supabase** (auth + database), **Tailwind CSS**, and a **Vercel** serverless function for GoAffPro. Brand: warm cream `#F7F3EE`, deep espresso `#2C1F1A`, warm gold `#B8936A`, Cormorant Garamond + Montserrat.

---

## Quick start (local)

```bash
npm install
cp .env.example .env     # then fill in your Supabase values
npm run dev              # opens http://localhost:5173
```

If the app shows a "needs its Supabase keys" screen, your `.env` isn't filled in yet.

---

## Step-by-step setup

### 1. Supabase — create the database

1. Go to your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   This creates all 4 tables (`partners`, `kits`, `kit_pieces`, `content_log`),
   an `admins` table, and Row Level Security so partners only ever see their own data.
3. *(Optional)* Run [`supabase/seed.sql`](supabase/seed.sql) to add one sample partner with a kit for testing.

### 2. Supabase — create your admin login

1. Supabase → **Authentication → Users → Add user**.
2. Enter **your email** and **a password** (this password = your dashboard password). Check **Auto Confirm User**.
3. Back in **SQL Editor**, run this (swap in your email) to mark yourself as admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```

### 3. Supabase — get your API keys

Supabase → **Project Settings → API**. Copy:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

Put them in your `.env` (local) and later in Vercel (production).

### 4. GoAffPro — enable live commission data

Partners' earnings come from GoAffPro's **admin API**, which needs an admin access token.
For security, that token lives **only** on the server (the `/api/commissions` function) and is never sent to browsers.

1. GoAffPro → **Settings → Advanced Settings → API Keys** → copy the **Access Token**.
2. Add it as a server-side env var (no `VITE_` prefix): `GOAFFPRO_ACCESS_TOKEN`.

Until you add this token, the portal simply shows "Commission data is not connected yet" — everything else works.

> Your public token (`5bbb5e7d…`) is already in `.env.example`. The public token alone can't fetch a specific partner's earnings — that's why the admin access token is required.

### 5. Run locally

```bash
npm run dev
```

- Partner portal: http://localhost:5173/login
- Internal dashboard: http://localhost:5173/admin/login

> **Note on magic-link emails locally:** Supabase's built-in email is rate-limited. For reliable delivery (and production), configure SMTP in Supabase → **Authentication → Email Templates / SMTP Settings**.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel → **Add New Project** → import the repo. Vercel auto-detects Vite (build `npm run build`, output `dist`). The `/api` folder deploys as serverless functions automatically.
3. In **Settings → Environment Variables**, add **all** of these:

   | Name | Value | Exposed to browser? |
   |------|-------|---------------------|
   | `VITE_SUPABASE_URL` | your Supabase URL | yes (safe) |
   | `VITE_SUPABASE_ANON_KEY` | anon public key | yes (safe) |
   | `VITE_GOAFFPRO_PUBLIC_TOKEN` | the public token | yes (safe) |
   | `GOAFFPRO_ACCESS_TOKEN` | GoAffPro admin token | **no — server only** |
   | `GOAFFPRO_PUBLIC_TOKEN` | the public token | **no — server only** |
   | `SUPABASE_URL` | your Supabase URL | **no — server only** |
   | `SUPABASE_ANON_KEY` | anon public key | **no — server only** |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role secret — needed by the **Sync from GoAffPro** button | **no — server only** |
   | `AFFILIATE_STORE_URL` *(optional)* | override the affiliate storefront URL | **no — server only** |

4. Deploy. Then in Supabase → **Authentication → URL Configuration**, add your Vercel URL (e.g. `https://your-app.vercel.app`) to **Site URL** and **Redirect URLs** so magic links return to your live site.

---

## How it works

| Area | Detail |
|------|--------|
| Partner auth | Supabase magic link. Partner enters email → secure link → portal. No passwords. |
| Admin auth | Supabase email + password account, gated by the `admins` table. |
| Data isolation | Row Level Security: a partner can read/update only their own rows; admin sees all. |
| Commission earnings | `/api/commissions` verifies the partner's session, then fetches *their* GoAffPro data with the secret admin token. |
| Partner note | Stored in `partners.partner_message`; shown to you in the dashboard. |

### Routes
- `/` — landing (choose Partner or Internal)
- `/login` — partner magic-link sign in
- `/portal` — partner portal (protected)
- `/admin/login` — admin sign in
- `/admin` — internal dashboard (admin only)

---

## Project structure

```
planet-portal/
├── api/commissions.js          # Vercel serverless fn (GoAffPro, server-only secrets)
├── src/
│   ├── App.jsx                 # routes + auth guards
│   ├── context/AuthContext.jsx # Supabase session + admin check
│   ├── lib/supabase.js         # Supabase client
│   ├── lib/goaffpro.js         # calls /api/commissions
│   ├── components/ui.jsx       # shared on-brand UI
│   └── pages/                  # Landing, PartnerLogin, PartnerPortal,
│                               #   AdminLogin, AdminDashboard, SetupNotice
├── supabase/schema.sql         # tables + RLS (run first)
├── supabase/seed.sql           # optional sample data
├── tailwind.config.js          # brand colors + fonts
└── vercel.json                 # SPA rewrites + build config
```

---

## Database schema

- **partners** — `id, name, email, instagram, status, commission_link, partner_message, created_at`
  status ∈ {Contacted, Interested, Active Partner, Passed}
- **kits** — `id, partner_id, status, ship_date, tracking_number, return_by_date, notes, created_at`
  status ∈ {Preparing, Shipped, Delivered, Return Pending, Returned}
- **kit_pieces** — `id, kit_id, piece_name, color, photo_url, partner_decision`
  partner_decision ∈ {Keep, Return, null}
- **content_log** — `id, partner_id, content_type, post_date, notes, created_at`
  content_type ∈ {Reel, Feed Post, Story, Blog Post}

> Added beyond the original spec: `partners.partner_message` (the partner's note to you) and an `admins` table (so the dashboard knows who you are). The `kits.status` set was expanded slightly (Preparing / Returned) for a smoother workflow.
