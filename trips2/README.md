# Trips 2 — ترحال

Multi-tenant SaaS for Kuwaiti travel agencies. React + Vite + Tailwind (RTL-first, Arabic primary / English secondary) on Supabase (Postgres + Auth + Storage + RLS).

## What's built so far

- **Database schema** (`supabase/migrations/20260706000001_schema.sql`): agencies, profiles, clients, bookings, booking_items, quotes, payments, documents, message_templates, portal_links. All money columns are `numeric(10,3)` KWD. Booking references are auto-generated (`BK-YYMM-0001`). Profiles are auto-created from auth user metadata (no self-registration).
- **Row Level Security** (`...000002_rls.sql`): every tenant table is scoped by `agency_id`; `superadmin` sees everything, `owner`/`agent` only their agency. Clients have **no accounts** — the read-only portal goes through the `get_portal_booking(token)` RPC (validates token + expiry, never exposes cost prices), and shared quotes through `get_public_quote(token)`. Storage policies scope the `documents` bucket by `<agency_id>/...` path prefix.
- **Seed data** (`supabase/seed.sql`): demo agency, 3 users (superadmin / owner / agent), clients (one with a passport expiring in 3 months), bookings (one departing today, one Umrah, one completed), items, payments (incl. an overdue installment), Arabic WhatsApp templates, and a portal link.
- **Auth + role routing**: email/password login; superadmin lands on the agencies console, owner/agent on the dashboard; route guards per role.
- **Booking CRUD flow**: clients CRUD → create booking → add items (cost/sell KWD, 3 decimals) → record payments (KNET link / cash / transfer) → paid vs remaining computed live. Passport-expiry warning when validity is < 6 months past the travel date. Umrah bookings show optional Hijri (Umm al-Qura) dates. WhatsApp payment-reminder button fills the Arabic template (`{{client_name}}`, `{{amount}}`, `{{booking_ref}}`) and opens `wa.me`.
- **Dashboard**: today's departures, overdue payments, bookings by status.

Not yet built (schema is ready for them): quote builder UI + printable PDF, client portal page, template management UI, document uploads UI.

## Local setup

```bash
# 1. Start Supabase locally (needs the Supabase CLI + Docker)
cd trips2
supabase init        # first time only — then keep our migrations/ and seed.sql
supabase start
supabase db reset    # applies migrations + seed.sql

# 2. Configure the frontend
cp .env.example .env.local   # paste the URL + anon key printed by `supabase start`

# 3. Run
npm install
npm run dev
```

Demo logins (local seed, password `password123`):

| Email | Role |
|---|---|
| `superadmin@trips2.test` | superadmin |
| `owner@golden.test` | owner |
| `agent@golden.test` | agent |

## Hosted Supabase

1. Create a project, then run both files in `supabase/migrations/` in the SQL editor (in order).
2. Create users from **Authentication → Add user**, setting *User Metadata* to e.g. `{"full_name":"...","role":"owner","agency_id":"<agency uuid>"}` — the trigger creates the profile row. Superadmins use `{"role":"superadmin"}` with no `agency_id`.
3. Do **not** run `seed.sql` on production (it inserts demo auth users).
