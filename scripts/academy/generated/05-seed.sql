INSERT INTO public.users (id, email, full_name, role, is_demo)
VALUES ('75fdc0ce-b951-4c70-9ce1-70fa8c46ab23', 'capture@aliice.local', 'Capture User', 'admin', true)
ON CONFLICT (id) DO UPDATE SET is_demo = true, role = 'admin';

SELECT public.seed_demo_data('75fdc0ce-b951-4c70-9ce1-70fa8c46ab23'::uuid);

-- Synthetic data for screens that seed_demo_data() does not cover.
--
-- seed_demo_data() seeds providers, deal_stages, patients, appointments,
-- consultations, deals, tasks, emails, patient_notes, email_templates and
-- workflows. Twelve documentation modules describe screens driven by tables it
-- never touches, which would otherwise capture as empty states:
--   invoices, financials, tardoc, medidata-insurance, payments, statistics,
--   services, lead-import, lead-analytics, missed-calls
--
-- Everything here is obviously fictional. Every row carries is_demo = true.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Service catalogue (prices in CHF)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (id, name, description, sort_order)
VALUES
  ('11111111-0000-4000-8000-000000000001', 'Injectables', 'Botulinum toxin and fillers', 1),
  ('11111111-0000-4000-8000-000000000002', 'Surgery', 'Surgical procedures', 2),
  ('11111111-0000-4000-8000-000000000003', 'Dermatology', 'Medical skin treatment', 3),
  ('11111111-0000-4000-8000-000000000004', 'Laser', 'Laser and energy-based devices', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.services (id, category_id, name, code, description, base_price, is_active)
VALUES
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'Botulinum toxin — upper face', 'INJ-BTX-UF', 'Glabella, forehead and crow''s feet', 690, true),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'Hyaluronic acid filler — 1 ml', 'INJ-HA-1', 'Mid-face or lip volumisation', 850, true),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 'Blepharoplasty — upper lids', 'SUR-BLEPH-U', 'Upper eyelid correction', 4200, true),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002', 'Liposuction — flanks', 'SUR-LIPO-FL', 'Flank contouring under general anaesthesia', 6800, true),
  ('22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000003', 'Dermatological consultation', 'DER-CONS', 'Medically indicated skin assessment', 220, true),
  ('22222222-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000003', 'Excision of skin lesion', 'DER-EXC', 'Medically indicated excision with histology', 480, true),
  ('22222222-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000004', 'Fractional laser resurfacing', 'LAS-FRAC', 'Full-face resurfacing', 1450, true),
  ('22222222-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000004', 'Laser hair removal — legs', 'LAS-HAIR-LG', 'Per session', 380, false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Billing entity, so the Statistics entity filter is populated
-- ---------------------------------------------------------------------------
INSERT INTO public.providers (id, name, specialty, email, role, gln, zsr, city, canton, is_active, is_demo)
VALUES
  ('33333333-0000-4000-8000-000000000001', 'Clinique Démonstration SA', 'Billing entity', 'billing@example.invalid', 'billing_entity', '7601000000001', 'X123456', 'Genève', 'GE', true, true),
  ('33333333-0000-4000-8000-000000000002', 'Dr Camille Rochat', 'Aesthetic medicine', 'c.rochat@example.invalid', 'doctor', '7601000000002', 'Y234567', 'Genève', 'GE', true, true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Invoices across every status, both Swiss billing routes
-- ---------------------------------------------------------------------------
WITH demo_patients AS (
  SELECT id, first_name, last_name, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.patients
  WHERE is_demo = true
)
INSERT INTO public.invoices (
  id, patient_id, invoice_number, invoice_date, due_date, treatment_date,
  doctor_name, provider_id, provider_name, provider_gln, provider_zsr,
  subtotal, vat_amount, total_amount, paid_amount, status, payment_method,
  billing_type, health_insurance_law, title, reminder_level, reminder_fees,
  paid_at, email_sent_at, is_complimentary, is_archived, is_demo
)
SELECT
  ('44444444-0000-4000-8000-00000000000' || v.n)::uuid,
  p.id,
  'DEMO-2026-' || LPAD(v.n::text, 4, '0'),
  CURRENT_DATE - v.age_days,
  CURRENT_DATE - v.age_days + 30,
  (CURRENT_DATE - v.age_days)::timestamptz,
  'Dr Camille Rochat',
  '33333333-0000-4000-8000-000000000001',
  'Clinique Démonstration SA',
  '7601000000001',
  'X123456',
  v.subtotal,
  ROUND(v.subtotal * 0.081, 2),
  ROUND(v.subtotal * 1.081, 2),
  v.paid,
  v.status,
  v.method,
  v.billing_type,
  v.law,
  v.title,
  v.reminder_level,
  v.reminder_fees,
  CASE WHEN v.paid > 0 THEN (CURRENT_DATE - v.age_days + 5)::timestamptz ELSE NULL END,
  (CURRENT_DATE - v.age_days + 1)::timestamptz,
  v.complimentary,
  false,
  true
FROM (VALUES
  (1, 850,  0.00,     'OPEN',         'card',      'TG', NULL,  'Filler treatment',            0, 0.00,  false, 12),
  (2, 690,  745.89,   'PAID',         'card',      'TG', NULL,  'Botulinum toxin treatment',   0, 0.00,  false, 40),
  (3, 4200, 2000.00,  'PARTIAL_PAID', 'transfer',  'TG', NULL,  'Upper blepharoplasty',        0, 0.00,  false, 60),
  (4, 220,  259.82,   'OVERPAID',     'cash',      'TG', NULL,  'Dermatological consultation', 0, 0.00,  false, 25),
  (5, 480,  0.00,     'OPEN',         'insurance', 'TP', 'KVG', 'Excision of skin lesion',     2, 20.00, false, 75),
  (6, 1450, 0.00,     'CANCELLED',    'card',      'TG', NULL,  'Laser resurfacing',           0, 0.00,  false, 30),
  (7, 380,  0.00,     'OPEN',         'card',      'TG', NULL,  'Complimentary touch-up',      0, 0.00,  true,  8),
  (8, 6800, 3000.00,  'PARTIAL_LOSS', 'transfer',  'TG', NULL,  'Liposuction — flanks',        3, 40.00, false, 150),
  (9, 220,  237.82,   'PAID',         'insurance', 'TP', 'KVG', 'Dermatological consultation', 0, 0.00,  false, 20)
) AS v(n, subtotal, paid, status, method, billing_type, law, title, reminder_level, reminder_fees, complimentary, age_days)
JOIN demo_patients p ON p.rn = ((v.n - 1) % (SELECT GREATEST(COUNT(*), 1) FROM demo_patients)) + 1
ON CONFLICT (id) DO NOTHING;

-- Invoice lines, including TarDoc-coded ones for the insured invoices
INSERT INTO public.invoice_line_items (
  id, invoice_id, sort_order, code, service_id, name, quantity, unit_price,
  discount_percent, total_price, vat_rate, vat_rate_value, vat_amount,
  tardoc_code, tardoc_time, price_al, price_tl, catalog_name
)
SELECT
  ('55555555-0000-4000-8000-00000000000' || v.n)::uuid,
  ('44444444-0000-4000-8000-00000000000' || v.invoice_n)::uuid,
  1,
  v.code,
  v.service_id::uuid,
  v.name,
  1,
  v.price,
  0,
  v.price,
  '8.1',
  8.1,
  ROUND(v.price * 0.081, 2),
  v.tardoc,
  v.tardoc_time,
  v.al,
  v.tl,
  v.catalog
FROM (VALUES
  (1, 1, 'INJ-HA-1',    '22222222-0000-4000-8000-000000000002', 'Hyaluronic acid filler — 1 ml', 850,  NULL,      NULL, NULL, NULL, 'Private'),
  (2, 2, 'INJ-BTX-UF',  '22222222-0000-4000-8000-000000000001', 'Botulinum toxin — upper face',  690,  NULL,      NULL, NULL, NULL, 'Private'),
  (3, 3, 'SUR-BLEPH-U', '22222222-0000-4000-8000-000000000003', 'Blepharoplasty — upper lids',   4200, NULL,      NULL, NULL, NULL, 'Private'),
  (4, 4, 'DER-CONS',    '22222222-0000-4000-8000-000000000005', 'Dermatological consultation',   220,  'AA.00.0010', 10, 9.57, 8.19, 'TARDOC'),
  (5, 5, 'DER-EXC',     '22222222-0000-4000-8000-000000000006', 'Excision of skin lesion',       480,  'AA.10.0210', 25, 21.4, 18.6, 'TARDOC'),
  (6, 9, 'DER-CONS',    '22222222-0000-4000-8000-000000000005', 'Dermatological consultation',   220,  'AA.00.0010', 10, 9.57, 8.19, 'TARDOC')
) AS v(n, invoice_n, code, service_id, name, price, tardoc, tardoc_time, al, tl, catalog)
ON CONFLICT (id) DO NOTHING;

-- Recorded payments, so the payments and cash views are populated
INSERT INTO public.invoice_payments (id, invoice_id, amount, payment_method, payment_date, notes)
VALUES
  ('66666666-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000002', 745.89,  'card',     CURRENT_DATE - 35, 'Paid at reception'),
  ('66666666-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000003', 2000.00, 'transfer', CURRENT_DATE - 55, 'First instalment'),
  ('66666666-0000-4000-8000-000000000003', '44444444-0000-4000-8000-000000000004', 259.82,  'cash',     CURRENT_DATE - 20, 'Overpaid — refund due'),
  ('66666666-0000-4000-8000-000000000004', '44444444-0000-4000-8000-000000000009', 237.82,  'transfer', CURRENT_DATE - 15, 'Insurer payment')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Missed / dropped calls for the AI agents and missed-calls screens
-- ---------------------------------------------------------------------------
INSERT INTO public.dropped_calls (
  id, retell_call_id, from_number, to_number, call_duration_seconds,
  disconnection_reason, status, assignment_method, created_at
)
VALUES
  ('77777777-0000-4000-8000-000000000001', 'demo-call-1', '+41791234567', '+41225550100', 12, 'user_hangup',   'pending',   'round_robin', now() - interval '2 hours'),
  ('77777777-0000-4000-8000-000000000002', 'demo-call-2', '+41786543210', '+41225550100', 45, 'no_answer',     'contacted', 'round_robin', now() - interval '1 day'),
  ('77777777-0000-4000-8000-000000000003', 'demo-call-3', '+41761112233', '+41225550100', 3,  'dial_no_answer','pending',   'manual',      now() - interval '5 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.call_logs (
  id, call_id, direction, from_number, to_number, call_status,
  disconnection_reason, duration_seconds, summary, source, contact_status, started_at, created_at
)
VALUES
  ('88888888-0000-4000-8000-000000000001', 'demo-log-1', 'inbound', '+41791234567', '+41225550100', 'ended', 'user_hangup', 12,
   'Caller asked about filler pricing and rang off before booking.', 'retell_ai', 'pending', now() - interval '2 hours', now() - interval '2 hours'),
  ('88888888-0000-4000-8000-000000000002', 'demo-log-2', 'outbound', '+41225550100', '+41786543210', 'ended', 'agent_hangup', 96,
   'Follow-up call — consultation booked for next week.', 'workflow', 'resolved', now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Embedded form leads for the lead-import and lead-analytics screens
-- ---------------------------------------------------------------------------
INSERT INTO public.embed_form_leads (
  id, first_name, last_name, email, phone, service, location, message,
  form_type, status, utm_source, utm_campaign, created_at, updated_at
)
VALUES
  ('99999999-0000-4000-8000-000000000001', 'Léa',   'Baumgartner', 'lea.b@example.invalid',   '+41791110001', 'Injectables', 'Genève', 'Interested in lip filler — best time to call is mornings.', 'contact', 'new',       'meta',   'spring-injectables', now() - interval '1 day',  now() - interval '1 day'),
  ('99999999-0000-4000-8000-000000000002', 'Marco', 'Schnyder',    'marco.s@example.invalid', '+41791110002', 'Surgery',     'Genève', 'Would like a consultation about blepharoplasty.',           'contact', 'contacted', 'google', 'brand',              now() - interval '2 days', now() - interval '2 days'),
  ('99999999-0000-4000-8000-000000000003', 'Nadia', 'Ferreira',    'nadia.f@example.invalid', '+41791110003', 'Laser',       'Genève', NULL,                                                       'booking', 'converted', 'tiktok', 'laser-summer',       now() - interval '3 days', now() - interval '3 days'),
  ('99999999-0000-4000-8000-000000000004', 'Tobias','Wyss',        'tobias.w@example.invalid','+41791110004', 'Dermatology', 'Genève', 'Mole check requested.',                                     'contact', 'new',       'meta',   'derm-awareness',     now() - interval '5 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;
