-- Trips 2 — multi-tenant travel agency SaaS (Kuwait)
-- Migration 1: schema (tables, enums, triggers, indexes, storage bucket)

-- ---------------------------------------------------------------------------
-- Extensions & helper schema
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('superadmin', 'owner', 'agent');
create type public.booking_status as enum ('new', 'confirmed', 'in_progress', 'completed', 'cancelled');
create type public.item_type as enum ('flight', 'hotel', 'visa', 'transport', 'other');
create type public.payment_method as enum ('knet_link', 'cash', 'transfer');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- ---------------------------------------------------------------------------
-- Agencies (tenants)
-- ---------------------------------------------------------------------------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- Arabic name (primary)
  name_en text,                             -- English name (secondary)
  logo_url text,
  whatsapp_number text,                     -- E.164, e.g. +96550000000
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (mirrors auth.users; superadmin has agency_id = null)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete restrict,
  role public.user_role not null default 'agent',
  full_name text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint superadmin_has_no_agency
    check ((role = 'superadmin' and agency_id is null) or (role <> 'superadmin' and agency_id is not null))
);

-- ---------------------------------------------------------------------------
-- Clients (no auth account — portal access is via portal_links tokens)
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  full_name text not null,
  phone text,                               -- E.164 for wa.me links
  email text,
  civil_id text,
  passport_number text,
  passport_expiry date,
  nationality text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create sequence public.booking_ref_seq;
grant usage, select on sequence public.booking_ref_seq to authenticated;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  reference text not null unique,
  status public.booking_status not null default 'new',
  destination text not null,
  travel_date date,
  return_date date,
  is_umrah boolean not null default false,  -- enables optional Hijri date display
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_after_travel check (return_date is null or travel_date is null or return_date >= travel_date)
);

create or replace function app.set_booking_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'BK-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.booking_ref_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger set_booking_reference before insert on public.bookings
  for each row execute function app.set_booking_reference();

-- ---------------------------------------------------------------------------
-- Booking items — all amounts KWD numeric(10,3)
-- ---------------------------------------------------------------------------
create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  item_type public.item_type not null,
  title text not null,
  details text,
  quantity integer not null default 1 check (quantity > 0),
  cost_kwd numeric(10,3) not null default 0 check (cost_kwd >= 0),
  sell_kwd numeric(10,3) not null default 0 check (sell_kwd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Quotes (items kept as jsonb snapshot: [{item_type,title,details,quantity,sell_kwd}])
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  title text not null,
  status public.quote_status not null default 'draft',
  items jsonb not null default '[]',
  valid_until date,
  notes text,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payments — a row with status 'pending' + due_date acts as a scheduled installment
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount_kwd numeric(10,3) not null check (amount_kwd > 0),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  due_date date,
  paid_at timestamptz,
  reference text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documents (files live in the 'documents' storage bucket, path: <agency_id>/<booking_id>/<file>)
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Message templates (Arabic WhatsApp texts with {{client_name}} {{amount}} {{booking_ref}})
-- ---------------------------------------------------------------------------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  category text not null default 'payment_reminder',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Portal links (client magic links; clients have no accounts)
-- ---------------------------------------------------------------------------
create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['agencies','profiles','clients','bookings','booking_items','quotes','payments','message_templates']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function app.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-create profile when an auth user is created with role metadata.
-- Users are always created by an admin (no self-registration): the creator
-- sets raw_user_meta_data = { full_name, role, agency_id }.
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, agency_id, role, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'agency_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'agent'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_profiles_agency on public.profiles (agency_id);
create index idx_clients_agency on public.clients (agency_id);
create index idx_bookings_agency on public.bookings (agency_id);
create index idx_bookings_travel_date on public.bookings (agency_id, travel_date);
create index idx_bookings_status on public.bookings (agency_id, status);
create index idx_booking_items_booking on public.booking_items (booking_id);
create index idx_booking_items_agency on public.booking_items (agency_id);
create index idx_quotes_agency on public.quotes (agency_id);
create index idx_payments_booking on public.payments (booking_id);
create index idx_payments_agency on public.payments (agency_id);
create index idx_payments_due on public.payments (agency_id, status, due_date);
create index idx_documents_booking on public.documents (booking_id);
create index idx_documents_agency on public.documents (agency_id);
create index idx_templates_agency on public.message_templates (agency_id);
create index idx_portal_links_booking on public.portal_links (booking_id);
create index idx_portal_links_agency on public.portal_links (agency_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for booking documents
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
