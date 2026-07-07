-- ============================================================================
-- "180 Days" — Supabase / PostgreSQL schema (Phase 2 backend)
-- ============================================================================
-- The current MVP stores everything in the browser (localStorage). This file
-- is the target schema for moving to Supabase with authentication and
-- Row Level Security so each employee sees only their own data.
--
-- Apply in the Supabase SQL editor. Requires the auth schema (default).
-- ============================================================================

-- ---------- profiles --------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  work_type     text,                                   -- admin_morning | admin_evening | shifts | teaching | custom
  ministry_type text,                                   -- general | education | health | shifts | other
  target_days   integer not null default 180,
  weekend_days  text[]  not null default array['friday','saturday'],
  daily_work_hours numeric not null default 7,
  monthly_perm_hours numeric not null default 12,
  monthly_perm_count integer not null default 4,
  year          integer not null default extract(year from now()),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- leave_entries ---------------------------------------------------
create table if not exists public.leave_entries (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  entry_type          text not null,                    -- annual | sick | emergency | unpaid | other
  start_date          date not null,
  end_date            date,
  start_time          time,
  end_time            time,
  duration_hours      numeric,
  calculated_work_days integer,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists leave_entries_user_idx on public.leave_entries (user_id, start_date);

-- ---------- public_holidays (shared reference data) -------------------------
create table if not exists public.public_holidays (
  id           bigint generated always as identity primary key,
  name         text not null,
  date         date not null,
  year         integer not null,
  is_confirmed boolean not null default false,          -- false = Hijri date pending moon-sighting
  source_note  text
);
create index if not exists public_holidays_year_idx on public.public_holidays (year);

-- ---------- calculation_snapshots (audit / history) -------------------------
create table if not exists public.calculation_snapshots (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  year                integer not null,
  completed_days      integer,
  available_work_days integer,
  remaining_to_target integer,
  safety_buffer       integer,
  status              text,                             -- safe | warning | danger
  generated_at        timestamptz not null default now()
);
create index if not exists snapshots_user_idx on public.calculation_snapshots (user_id, year);

-- ---------- settings (app-wide config, e.g. status thresholds) --------------
create table if not exists public.settings (
  id         bigint generated always as identity primary key,
  key        text unique not null,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
-- seed: editable status thresholds (safe >= 20, warning >= 10)
insert into public.settings (key, value)
values ('status_thresholds', '{"safe":20,"warning":10}')
on conflict (key) do nothing;

-- ============================================================================
-- Row Level Security — each user can only read/write their own rows
-- ============================================================================
alter table public.profiles             enable row level security;
alter table public.leave_entries        enable row level security;
alter table public.calculation_snapshots enable row level security;
alter table public.public_holidays      enable row level security;

-- profiles: owner-only
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_upsert_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- leave_entries: owner-only
create policy "leaves_all_own" on public.leave_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- calculation_snapshots: owner-only
create policy "snapshots_all_own" on public.calculation_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- public_holidays: readable by all authenticated users, writable by service role only
create policy "holidays_read_all" on public.public_holidays
  for select using (auth.role() = 'authenticated');

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch      before update on public.profiles      for each row execute function public.touch_updated_at();
create trigger leaves_touch        before update on public.leave_entries for each row execute function public.touch_updated_at();
