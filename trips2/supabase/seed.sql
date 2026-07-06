-- Trips 2 — seed data for LOCAL development (`supabase db reset` runs this).
--
-- Demo logins (password for all: password123):
--   superadmin@trips2.test  → superadmin
--   owner@golden.test       → owner  of "وكالة الرحلات الذهبية"
--   agent@golden.test       → agent  of "وكالة الرحلات الذهبية"
--
-- NOTE: inserting into auth.users like this only works on local/self-hosted
-- Supabase. On hosted projects, create the users from the dashboard
-- (Authentication → Add user) with the same raw_user_meta_data shown below;
-- the on_auth_user_created trigger builds the profile automatically.

-- ---------------------------------------------------------------------------
-- Agency
-- ---------------------------------------------------------------------------
insert into public.agencies (id, name, name_en, whatsapp_number, phone, email, address)
values (
  'a1000000-0000-0000-0000-000000000001',
  'وكالة الرحلات الذهبية',
  'Golden Trips Agency',
  '+96550001111',
  '+96522223333',
  'info@golden.test',
  'السالمية، شارع سالم المبارك، الكويت'
);

-- ---------------------------------------------------------------------------
-- Auth users (profiles are created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001'::uuid,
   'authenticated', 'authenticated', 'superadmin@trips2.test',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"مدير المنصة","role":"superadmin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002'::uuid,
   'authenticated', 'authenticated', 'owner@golden.test',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"عبدالله المطيري","role":"owner","agency_id":"a1000000-0000-0000-0000-000000000001"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003'::uuid,
   'authenticated', 'authenticated', 'agent@golden.test',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"سارة العنزي","role":"agent","agency_id":"a1000000-0000-0000-0000-000000000001"}', now(), now());

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('superadmin@trips2.test', 'owner@golden.test', 'agent@golden.test');

-- ---------------------------------------------------------------------------
-- Clients (فهد: passport expires soon → triggers the < 6 months warning)
-- ---------------------------------------------------------------------------
insert into public.clients (id, agency_id, full_name, phone, email, civil_id, passport_number, passport_expiry, nationality, created_by)
values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'محمد الكندري', '+96555510001', 'm.alkandari@example.com', '285010112345',
   'P1234567', current_date + interval '5 years', 'كويتي',
   'd0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'فهد العجمي', '+96555510002', 'f.alajmi@example.com', '290020254321',
   'P7654321', current_date + interval '3 months', 'كويتي',
   'd0000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
   'نورة الصباح', '+96555510003', 'n.alsabah@example.com', '287030309876',
   'P1112223', current_date + interval '2 years', 'كويتية',
   'd0000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Bookings: one departing TODAY (dashboard), one Umrah (Hijri), one completed
-- ---------------------------------------------------------------------------
insert into public.bookings (id, agency_id, client_id, reference, status, destination, travel_date, return_date, is_umrah, notes, created_by)
values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001', 'BK-DEMO-0001', 'confirmed',
   'إسطنبول، تركيا', current_date, current_date + interval '7 days', false,
   'عائلة من ٤ أفراد — فندق قريب من تقسيم',
   'd0000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002', 'BK-DEMO-0002', 'in_progress',
   'مكة المكرمة والمدينة المنورة', current_date + interval '20 days', current_date + interval '30 days', true,
   'عمرة — التأشيرة قيد الإصدار',
   'd0000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000003', 'BK-DEMO-0003', 'completed',
   'لندن، المملكة المتحدة', current_date - interval '40 days', current_date - interval '30 days', false,
   null,
   'd0000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Booking items (cost vs sell in KWD, 3 decimals)
-- ---------------------------------------------------------------------------
insert into public.booking_items (agency_id, booking_id, item_type, title, details, quantity, cost_kwd, sell_kwd)
values
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'flight', 'تذاكر طيران الجزيرة — الكويت / إسطنبول ذهاب وعودة', 'درجة سياحية، ٤ ركاب', 4, 85.000, 110.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'hotel', 'فندق تقسيم بلازا — ٧ ليالٍ', 'غرفتان عائليتان مع إفطار', 1, 420.000, 520.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'transport', 'استقبال وتوديع من المطار', 'سيارة عائلية خاصة', 1, 25.000, 40.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
   'visa', 'تأشيرة عمرة', 'شاملة التأمين', 1, 35.000, 50.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
   'flight', 'طيران الكويت / جدة ذهاب وعودة', null, 1, 95.000, 120.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
   'hotel', 'فندق أبراج الساعة بمكة — ٦ ليالٍ + المدينة ٤ ليالٍ', 'غرفة ثلاثية إطلالة على الحرم', 1, 650.000, 800.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003',
   'flight', 'الخطوط البريطانية — الكويت / لندن', 'درجة رجال الأعمال', 1, 380.000, 450.000),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003',
   'hotel', 'فندق هيلتون بارك لين — ١٠ ليالٍ', null, 1, 900.000, 1100.000);

-- ---------------------------------------------------------------------------
-- Payments: partial payments + one OVERDUE pending installment (dashboard)
-- ---------------------------------------------------------------------------
insert into public.payments (agency_id, booking_id, amount_kwd, method, status, due_date, paid_at, reference, created_by)
values
  -- Istanbul: total 1000.000 — paid 500, remaining 500 (installment overdue)
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   500.000, 'knet_link', 'paid', null, now() - interval '10 days', 'KNET-88421', 'd0000000-0000-0000-0000-000000000003'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   500.000, 'knet_link', 'pending', current_date - interval '3 days', null, null, 'd0000000-0000-0000-0000-000000000003'),
  -- Umrah: total 970.000 — deposit 300 paid, 670 pending later
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
   300.000, 'cash', 'paid', null, now() - interval '5 days', null, 'd0000000-0000-0000-0000-000000000003'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002',
   670.000, 'transfer', 'pending', current_date + interval '10 days', null, null, 'd0000000-0000-0000-0000-000000000003'),
  -- London: fully paid
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003',
   1550.000, 'transfer', 'paid', null, now() - interval '45 days', 'TRF-2201', 'd0000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- WhatsApp message templates (Arabic, with variables)
-- ---------------------------------------------------------------------------
insert into public.message_templates (agency_id, name, category, body)
values
  ('a1000000-0000-0000-0000-000000000001', 'تذكير دفعة مستحقة', 'payment_reminder',
   'عزيزي {{client_name}}، نذكّركم بالدفعة المتبقية بقيمة {{amount}} د.ك للحجز رقم {{booking_ref}}. يرجى التكرم بالسداد في أقرب وقت. شكراً لثقتكم بنا 🌟'),
  ('a1000000-0000-0000-0000-000000000001', 'تذكير قبل السفر', 'travel_reminder',
   'عزيزي {{client_name}}، نتمنى لكم رحلة سعيدة! نذكّركم بموعد رحلتكم للحجز رقم {{booking_ref}}. يرجى التواجد في المطار قبل الإقلاع بثلاث ساعات. رحلة موفقة ✈️'),
  ('a1000000-0000-0000-0000-000000000001', 'تأكيد استلام دفعة', 'payment_received',
   'عزيزي {{client_name}}، تم استلام دفعتكم بقيمة {{amount}} د.ك للحجز رقم {{booking_ref}} بنجاح. شكراً لكم 🙏');

-- ---------------------------------------------------------------------------
-- Portal link for the Istanbul booking (client magic link)
-- ---------------------------------------------------------------------------
insert into public.portal_links (agency_id, booking_id, token, expires_at, created_by)
values
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'demo-portal-token-istanbul', now() + interval '30 days', 'd0000000-0000-0000-0000-000000000003');
