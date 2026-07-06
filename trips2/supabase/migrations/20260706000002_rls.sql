-- Trips 2 — Migration 2: Row Level Security
--
-- Tenancy model:
--   * superadmin  → full access to everything (manages agencies)
--   * owner/agent → access only rows where agency_id = their profile's agency_id
--   * clients     → NO auth account; read-only portal via get_portal_booking(token) RPC

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so they don't recurse into profiles RLS)
-- ---------------------------------------------------------------------------
create or replace function app.user_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() and is_active
$$;

create or replace function app.user_agency()
returns uuid
language sql stable security definer set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid() and is_active
$$;

revoke execute on function app.user_role() from anon;
revoke execute on function app.user_agency() from anon;
grant execute on function app.user_role() to authenticated;
grant execute on function app.user_agency() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['agencies','profiles','clients','bookings','booking_items',
                           'quotes','payments','documents','message_templates','portal_links']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- agencies
-- ---------------------------------------------------------------------------
create policy "superadmin full access" on public.agencies
  for all using (app.user_role() = 'superadmin') with check (app.user_role() = 'superadmin');

create policy "members read own agency" on public.agencies
  for select using (id = app.user_agency());

create policy "owner updates own agency" on public.agencies
  for update using (app.user_role() = 'owner' and id = app.user_agency())
  with check (app.user_role() = 'owner' and id = app.user_agency());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "superadmin full access" on public.profiles
  for all using (app.user_role() = 'superadmin') with check (app.user_role() = 'superadmin');

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "read colleagues" on public.profiles
  for select using (agency_id is not null and agency_id = app.user_agency());

create policy "update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy "owner manages agency profiles" on public.profiles
  for update using (app.user_role() = 'owner' and agency_id = app.user_agency())
  with check (app.user_role() = 'owner' and agency_id = app.user_agency() and role <> 'superadmin');

-- ---------------------------------------------------------------------------
-- Tenant tables: identical policy set, generated in a loop.
--   read:  superadmin OR same agency
--   write: superadmin OR (owner/agent of the same agency)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','bookings','booking_items','quotes','payments',
                           'documents','message_templates','portal_links']
  loop
    execute format($p$
      create policy "tenant select" on public.%I for select
        using (app.user_role() = 'superadmin' or agency_id = app.user_agency())
    $p$, t);

    execute format($p$
      create policy "tenant insert" on public.%I for insert
        with check (
          app.user_role() = 'superadmin'
          or (app.user_role() in ('owner','agent') and agency_id = app.user_agency())
        )
    $p$, t);

    execute format($p$
      create policy "tenant update" on public.%I for update
        using (
          app.user_role() = 'superadmin'
          or (app.user_role() in ('owner','agent') and agency_id = app.user_agency())
        )
        with check (
          app.user_role() = 'superadmin'
          or (app.user_role() in ('owner','agent') and agency_id = app.user_agency())
        )
    $p$, t);

    execute format($p$
      create policy "tenant delete" on public.%I for delete
        using (
          app.user_role() = 'superadmin'
          or (app.user_role() in ('owner','agent') and agency_id = app.user_agency())
        )
    $p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: documents bucket, paths are <agency_id>/<booking_id>/<filename>
-- ---------------------------------------------------------------------------
create policy "tenant reads own agency files" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (app.user_role() = 'superadmin' or (storage.foldername(name))[1] = app.user_agency()::text)
  );

create policy "tenant uploads to own agency folder" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (app.user_role() = 'superadmin'
         or (app.user_role() in ('owner','agent') and (storage.foldername(name))[1] = app.user_agency()::text))
  );

create policy "tenant deletes own agency files" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (app.user_role() = 'superadmin'
         or (app.user_role() in ('owner','agent') and (storage.foldername(name))[1] = app.user_agency()::text))
  );

-- ---------------------------------------------------------------------------
-- Client portal RPC — the ONLY road into tenant data without a session.
-- Validates a live portal token and returns a read-only snapshot.
-- Never exposes cost prices, internal notes, or other clients' data.
-- ---------------------------------------------------------------------------
create or replace function public.get_portal_booking(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_link public.portal_links;
begin
  select * into v_link
  from public.portal_links
  where token = p_token and not revoked and expires_at > now();

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'agency', (
      select jsonb_build_object(
        'name', a.name, 'name_en', a.name_en, 'logo_url', a.logo_url,
        'whatsapp_number', a.whatsapp_number, 'phone', a.phone
      )
      from public.agencies a where a.id = v_link.agency_id
    ),
    'booking', (
      select jsonb_build_object(
        'reference', b.reference, 'status', b.status, 'destination', b.destination,
        'travel_date', b.travel_date, 'return_date', b.return_date, 'is_umrah', b.is_umrah
      )
      from public.bookings b where b.id = v_link.booking_id
    ),
    'client_name', (
      select c.full_name
      from public.clients c
      join public.bookings b on b.client_id = c.id
      where b.id = v_link.booking_id
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'item_type', i.item_type, 'title', i.title, 'details', i.details,
        'quantity', i.quantity, 'sell_kwd', i.sell_kwd
      ) order by i.created_at), '[]'::jsonb)
      from public.booking_items i where i.booking_id = v_link.booking_id
    ),
    'total_kwd', (
      select coalesce(sum(i.sell_kwd * i.quantity), 0)
      from public.booking_items i where i.booking_id = v_link.booking_id
    ),
    'paid_kwd', (
      select coalesce(sum(p.amount_kwd), 0)
      from public.payments p where p.booking_id = v_link.booking_id and p.status = 'paid'
    ),
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object('name', d.name) order by d.created_at), '[]'::jsonb)
      from public.documents d where d.booking_id = v_link.booking_id
    )
  );
end $$;

grant execute on function public.get_portal_booking(text) to anon, authenticated;

-- Same idea for shared quote pages (quote builder share link / printable page).
create or replace function public.get_public_quote(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_quote public.quotes;
begin
  select * into v_quote
  from public.quotes
  where token = p_token
    and status <> 'draft'
    and (valid_until is null or valid_until >= current_date);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'agency', (
      select jsonb_build_object(
        'name', a.name, 'name_en', a.name_en, 'logo_url', a.logo_url,
        'whatsapp_number', a.whatsapp_number, 'phone', a.phone
      )
      from public.agencies a where a.id = v_quote.agency_id
    ),
    'title', v_quote.title,
    'status', v_quote.status,
    'items', v_quote.items,
    'valid_until', v_quote.valid_until,
    'client_name', (select c.full_name from public.clients c where c.id = v_quote.client_id),
    'created_at', v_quote.created_at
  );
end $$;

grant execute on function public.get_public_quote(text) to anon, authenticated;
