-- Comprehensive Demo Data Seeding Script
-- For stenorio@roteglobal.com.ec demo account
-- Creates 100 patients with appointments, consultations, invoices, deals, tasks, etc.
--
-- SAFETY: This script will NOT affect production data because:
-- 1. All records have is_demo = true (isolated via RLS policies)
-- 2. Uses ON CONFLICT DO NOTHING (won't overwrite existing records)
-- 3. Uses unique demo UUID patterns (d0000000-xxxx-...) to avoid collisions
-- 4. Only INSERT statements - no UPDATE or DELETE on existing data

-- =============================================
-- STEP 1: Mark the demo user
-- =============================================
-- First, run this to mark stenorio@roteglobal.com.ec as a demo user:
UPDATE users SET is_demo = true WHERE email = 'stenorio@roteglobal.com.ec';

-- =============================================
-- STEP 2: Create Demo Providers (Doctors)
-- =============================================
INSERT INTO providers (id, name, specialty, email, phone, is_demo)
VALUES
  ('d0000001-0001-0000-0000-000000000001', 'Dr. Carlos Mendez', 'Plastic Surgery', 'dr.mendez@demo.clinic', '+593-2-555-0101', true),
  ('d0000001-0002-0000-0000-000000000002', 'Dr. Maria Santos', 'Dermatology', 'dr.santos@demo.clinic', '+593-2-555-0102', true),
  ('d0000001-0003-0000-0000-000000000003', 'Dr. Roberto Vega', 'Cosmetic Surgery', 'dr.vega@demo.clinic', '+593-2-555-0103', true),
  ('d0000001-0004-0000-0000-000000000004', 'Dr. Ana Gutierrez', 'Aesthetic Medicine', 'dr.gutierrez@demo.clinic', '+593-2-555-0104', true),
  ('d0000001-0005-0000-0000-000000000005', 'Dr. Luis Paredes', 'Reconstructive Surgery', 'dr.paredes@demo.clinic', '+593-2-555-0105', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STEP 3: Create Demo Deal Stages
-- =============================================
INSERT INTO deal_stages (id, name, type, sort_order, is_default, is_demo)
VALUES
  ('d0000002-0001-0000-0000-000000000001', 'New Lead', 'lead'::deal_stage_type, 1, true, true),
  ('d0000002-0002-0000-0000-000000000002', 'Consultation Scheduled', 'consultation'::deal_stage_type, 2, false, true),
  ('d0000002-0003-0000-0000-000000000003', 'Proposal Sent', 'follow_up'::deal_stage_type, 3, false, true),
  ('d0000002-0004-0000-0000-000000000004', 'Surgery Scheduled', 'surgery'::deal_stage_type, 4, false, true),
  ('d0000002-0005-0000-0000-000000000005', 'Post-Op Care', 'post_op'::deal_stage_type, 5, false, true),
  ('d0000002-0006-0000-0000-000000000006', 'Completed', 'other'::deal_stage_type, 6, false, true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STEP 4: Generate 100 Demo Patients
-- =============================================
DO $$
DECLARE
  first_names text[] := ARRAY['Sofia', 'Valentina', 'Camila', 'Isabella', 'Mariana', 'Lucia', 'Gabriela', 'Andrea', 'Paula', 'Carolina',
                              'Diego', 'Sebastian', 'Mateo', 'Nicolas', 'Alejandro', 'Daniel', 'Santiago', 'Juan', 'Carlos', 'Miguel',
                              'Elena', 'Victoria', 'Natalia', 'Fernanda', 'Adriana', 'Monica', 'Patricia', 'Laura', 'Diana', 'Rosa',
                              'Fernando', 'Ricardo', 'Eduardo', 'Pablo', 'Jorge', 'Roberto', 'Luis', 'Antonio', 'Marco', 'Pedro'];
  
  last_names text[] := ARRAY['Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Hernandez', 'Perez', 'Sanchez', 'Ramirez', 'Torres',
                             'Flores', 'Rivera', 'Gomez', 'Diaz', 'Reyes', 'Morales', 'Jimenez', 'Ruiz', 'Alvarez', 'Mendoza',
                             'Castillo', 'Romero', 'Vargas', 'Ortiz', 'Ramos', 'Cruz', 'Santos', 'Gutierrez', 'Chavez', 'Medina'];
  
  genders text[] := ARRAY['female', 'female', 'female', 'female', 'female', 'female', 'male', 'male', 'male', 'male'];
  sources text[] := ARRAY['google', 'meta', 'manual', 'event', 'google', 'meta', 'manual', 'event'];
  stages text[] := ARRAY['lead', 'consultation', 'surgery', 'post_op', 'completed'];
  professions text[] := ARRAY['Doctor', 'Engineer', 'Teacher', 'Lawyer', 'Business Owner', 'Marketing Manager', 'Architect', 'Accountant', 'Designer', 'Consultant'];
  
  i int;
  patient_id uuid;
  fn text;
  ln text;
  gender text;
  pat_email text;
  dob date;
BEGIN
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    fn := first_names[1 + (i % array_length(first_names, 1))];
    ln := last_names[1 + ((i * 3) % array_length(last_names, 1))];
    gender := genders[1 + (i % array_length(genders, 1))];
    pat_email := lower(fn) || '.' || lower(ln) || i || '@demo.com';
    dob := '1965-01-01'::date + (i * 150 || ' days')::interval;
    
    INSERT INTO patients (
      id, first_name, last_name, email, phone, gender, dob, 
      marital_status, nationality, street_address, postal_code, town,
      profession, source, notes, lifecycle_stage, is_demo, created_at
    ) VALUES (
      patient_id, fn, ln, pat_email, '+593-9-' || lpad((1000000 + i * 1234)::text, 7, '0'),
      gender, dob,
      CASE WHEN i % 3 = 0 THEN 'married' WHEN i % 3 = 1 THEN 'single' ELSE 'divorced' END,
      'Ecuadorian',
      i || ' Av. Principal, Edificio ' || (i % 20 + 1),
      '17' || lpad((i % 100)::text, 3, '0'),
      CASE WHEN i % 3 = 0 THEN 'Quito' WHEN i % 3 = 1 THEN 'Guayaquil' ELSE 'Cuenca' END,
      professions[1 + (i % array_length(professions, 1))],
      sources[1 + (i % array_length(sources, 1))],
      'Demo patient #' || i || ' - interested in aesthetic procedures',
      stages[1 + (i % array_length(stages, 1))],
      true,
      now() - ((100 - i) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================
-- STEP 5: Generate Appointments (2 per patient avg)
-- =============================================
DO $$
DECLARE
  i int;
  j int;
  patient_id uuid;
  provider_ids uuid[] := ARRAY[
    'd0000001-0001-0000-0000-000000000001'::uuid,
    'd0000001-0002-0000-0000-000000000002'::uuid,
    'd0000001-0003-0000-0000-000000000003'::uuid,
    'd0000001-0004-0000-0000-000000000004'::uuid,
    'd0000001-0005-0000-0000-000000000005'::uuid
  ];
  statuses text[] := ARRAY['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
  reasons text[] := ARRAY['Initial Consultation', 'Follow-up', 'Pre-Surgery Assessment', 'Post-Op Check', 'Treatment Session', 'Botox Appointment', 'Filler Consultation'];
  appt_id uuid;
  start_time timestamp;
  appt_status text;
BEGIN
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    -- Create 1-3 appointments per patient
    FOR j IN 1..(1 + (i % 3)) LOOP
      appt_id := ('d0000004-' || lpad(to_hex(i), 4, '0') || '-000' || j::text || '-0000-000000000001')::uuid;
      
      -- Past, present, or future appointment
      IF j = 1 THEN
        start_time := now() - ((30 - i % 30) || ' days')::interval + ((9 + (i % 8)) || ' hours')::interval;
        appt_status := 'completed';
      ELSIF j = 2 THEN
        start_time := now() + ((i % 14) || ' days')::interval + ((10 + (i % 6)) || ' hours')::interval;
        appt_status := CASE WHEN i % 4 = 0 THEN 'confirmed' ELSE 'scheduled' END;
      ELSE
        start_time := now() + ((14 + i % 21) || ' days')::interval + ((9 + (i % 9)) || ' hours')::interval;
        appt_status := 'scheduled';
      END IF;
      
      INSERT INTO appointments (
        id, patient_id, provider_id, start_time, end_time, status, reason, location, source, is_demo, created_at
      ) VALUES (
        appt_id,
        patient_id,
        provider_ids[1 + (i % 5)],
        start_time,
        start_time + '1 hour'::interval,
        appt_status::appointment_status,
        reasons[1 + ((i + j) % array_length(reasons, 1))],
        CASE WHEN i % 2 = 0 THEN 'Clinica Principal - Quito' ELSE 'Sucursal Guayaquil' END,
        'manual',
        true,
        start_time - '7 days'::interval
      ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- =============================================
-- STEP 6: Generate Consultations & Invoices
-- =============================================
DO $$
DECLARE
  i int;
  patient_id uuid;
  consult_id uuid;
  invoice_id uuid;
  cons_code text;
  inv_code text;
  scheduled_at timestamp;
  amounts decimal[] := ARRAY[250, 500, 750, 1000, 1500, 2000, 2500, 3500, 5000, 7500, 10000, 15000];
  procedures text[] := ARRAY['Botox Treatment', 'Dermal Fillers', 'Chemical Peel', 'Microdermabrasion', 'Laser Treatment', 
                              'Rhinoplasty Consultation', 'Breast Augmentation', 'Liposuction', 'Facelift Consultation', 'Body Contouring'];
BEGIN
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    -- Create consultation record
    consult_id := ('d0000005-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    cons_code := 'CONS-DEMO-' || lpad(i::text, 5, '0');
    scheduled_at := now() - ((60 - i % 60) || ' days')::interval;
    
    INSERT INTO consultations (
      id, patient_id, consultation_id, title, content, record_type,
      doctor_name, scheduled_at, payment_method, duration_seconds,
      created_by_name, is_archived, is_demo, created_at
    ) VALUES (
      consult_id,
      patient_id,
      cons_code,
      procedures[1 + (i % array_length(procedures, 1))] || ' - Consultation',
      '<h3>Clinical Notes</h3><p>Patient presented for ' || procedures[1 + (i % array_length(procedures, 1))] || 
      ' consultation.</p><p><strong>Assessment:</strong> Patient is a good candidate for the procedure.</p>' ||
      '<p><strong>Plan:</strong> Scheduled follow-up and provided pre-procedure instructions.</p>',
      'notes'::consultation_record_type,
      CASE 
        WHEN i % 5 = 0 THEN 'Dr. Carlos Mendez'
        WHEN i % 5 = 1 THEN 'Dr. Maria Santos'
        WHEN i % 5 = 2 THEN 'Dr. Roberto Vega'
        WHEN i % 5 = 3 THEN 'Dr. Ana Gutierrez'
        ELSE 'Dr. Luis Paredes'
      END,
      scheduled_at,
      NULL,
      1800 + (i * 60),
      'Demo Staff',
      false,
      true,
      scheduled_at
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create invoice for 80% of patients
    IF i % 5 != 0 THEN
      invoice_id := ('d0000006-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
      inv_code := 'INV-DEMO-' || lpad(i::text, 5, '0');
      
      INSERT INTO consultations (
        id, patient_id, consultation_id, title, content, record_type,
        doctor_name, scheduled_at, payment_method, 
        invoice_total_amount, invoice_is_complimentary, invoice_is_paid,
        created_by_name, is_archived, is_demo, created_at
      ) VALUES (
        invoice_id,
        patient_id,
        inv_code,
        'Invoice - ' || procedures[1 + (i % array_length(procedures, 1))],
        '<h3>Invoice Details</h3><p><strong>Service:</strong> ' || procedures[1 + (i % array_length(procedures, 1))] || 
        '</p><p><strong>Description:</strong> Professional aesthetic services as discussed during consultation.</p>' ||
        '<p><strong>Estimated total:</strong> CHF ' || amounts[1 + (i % array_length(amounts, 1))] || '</p>',
        'invoice'::consultation_record_type,
        CASE 
          WHEN i % 5 = 1 THEN 'Dr. Carlos Mendez'
          WHEN i % 5 = 2 THEN 'Dr. Maria Santos'
          WHEN i % 5 = 3 THEN 'Dr. Roberto Vega'
          ELSE 'Dr. Ana Gutierrez'
        END,
        scheduled_at + '7 days'::interval,
        CASE WHEN i % 3 = 0 THEN 'Cash' WHEN i % 3 = 1 THEN 'Online Payment' ELSE 'Bank transfer' END,
        amounts[1 + (i % array_length(amounts, 1))],
        false,
        CASE WHEN i % 4 != 0 THEN true ELSE false END, -- 75% paid
        'Demo Staff',
        false,
        true,
        scheduled_at + '7 days'::interval
      ) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- =============================================
-- STEP 7: Generate Deals
-- =============================================
DO $$
DECLARE
  i int;
  patient_id uuid;
  deal_id uuid;
  stage_ids uuid[] := ARRAY[
    'd0000002-0001-0000-0000-000000000001'::uuid,
    'd0000002-0002-0000-0000-000000000002'::uuid,
    'd0000002-0003-0000-0000-000000000003'::uuid,
    'd0000002-0004-0000-0000-000000000004'::uuid,
    'd0000002-0005-0000-0000-000000000005'::uuid,
    'd0000002-0006-0000-0000-000000000006'::uuid
  ];
  deal_titles text[] := ARRAY['Facial Rejuvenation Package', 'Body Contouring Treatment', 'Rhinoplasty Procedure', 
                               'Breast Augmentation', 'Lip Enhancement', 'Full Facelift', 'Liposuction Package',
                               'Botox Treatment Plan', 'Dermal Filler Series', 'Laser Skin Resurfacing'];
  values decimal[] := ARRAY[1500, 2500, 5000, 7500, 10000, 12000, 15000, 20000, 25000, 35000];
BEGIN
  FOR i IN 1..70 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    deal_id := ('d0000007-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO deals (
      id, patient_id, stage_id, title, value, notes, is_demo, created_at, updated_at
    ) VALUES (
      deal_id,
      patient_id,
      stage_ids[1 + (i % 6)],
      deal_titles[1 + (i % array_length(deal_titles, 1))],
      values[1 + (i % array_length(values, 1))],
      'Demo deal for patient #' || i || '. ' || 
      CASE 
        WHEN i % 6 = 0 THEN 'New inquiry received.'
        WHEN i % 6 = 1 THEN 'Consultation scheduled for next week.'
        WHEN i % 6 = 2 THEN 'Proposal sent, awaiting response.'
        WHEN i % 6 = 3 THEN 'Surgery date confirmed.'
        WHEN i % 6 = 4 THEN 'Post-operative care in progress.'
        ELSE 'Treatment completed successfully.'
      END,
      true,
      now() - ((70 - i) || ' days')::interval,
      now() - ((i % 10) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================
-- STEP 8: Generate Tasks
-- =============================================
DO $$
DECLARE
  i int;
  patient_id uuid;
  task_id uuid;
  task_names text[] := ARRAY['Follow up call', 'Send treatment plan', 'Schedule appointment', 'Verify insurance',
                              'Send pre-op instructions', 'Post-op check reminder', 'Payment follow-up',
                              'Review lab results', 'Update patient records', 'Confirm consultation'];
  statuses text[] := ARRAY['not_started', 'in_progress', 'completed'];
  priorities text[] := ARRAY['low', 'medium', 'high'];
  types text[] := ARRAY['todo', 'call', 'email', 'other'];
BEGIN
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    task_id := ('d0000008-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO tasks (
      id, patient_id, name, content, status, priority, type, activity_date, 
      created_by_name, is_demo, created_at
    ) VALUES (
      task_id,
      patient_id,
      task_names[1 + (i % array_length(task_names, 1))],
      'Demo task for patient #' || i,
      statuses[1 + (i % 3)]::task_status,
      priorities[1 + (i % 3)]::task_priority,
      types[1 + (i % 4)]::task_type,
      now() + ((-10 + i % 20) || ' days')::interval,
      'Demo Staff',
      true,
      now() - ((50 - i % 50) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================
-- STEP 9: Generate Patient Notes
-- =============================================
DO $$
DECLARE
  i int;
  patient_id uuid;
  note_id uuid;
  note_templates text[] := ARRAY[
    'Patient interested in facial rejuvenation options. Discussed Botox and filler treatments.',
    'Reviewed medical history. No contraindications for proposed procedure.',
    'Patient has realistic expectations. Scheduled for pre-operative assessment.',
    'Follow-up consultation completed. Patient satisfied with initial results.',
    'Discussed payment options and treatment timeline.',
    'Patient inquired about recovery time and post-procedure care.',
    'Provided detailed information about procedure risks and benefits.',
    'Patient needs to complete blood work before scheduling surgery.',
    'Insurance pre-authorization submitted. Awaiting response.',
    'Post-op day 7: Healing well, no complications noted.'
  ];
BEGIN
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    note_id := ('d0000009-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO patient_notes (
      id, patient_id, author_name, body, is_demo, created_at
    ) VALUES (
      note_id,
      patient_id,
      CASE 
        WHEN i % 5 = 0 THEN 'Dr. Carlos Mendez'
        WHEN i % 5 = 1 THEN 'Dr. Maria Santos'
        WHEN i % 5 = 2 THEN 'Dr. Roberto Vega'
        WHEN i % 5 = 3 THEN 'Nurse Ana'
        ELSE 'Reception Staff'
      END,
      note_templates[1 + (i % array_length(note_templates, 1))],
      true,
      now() - ((60 - i % 60) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================
-- STEP 10: Generate Emails
-- =============================================
DO $$
DECLARE
  i int;
  patient_id uuid;
  email_id uuid;
  fn text;
  ln text;
  subjects text[] := ARRAY['Your Upcoming Appointment', 'Treatment Plan Information', 'Post-Procedure Care Instructions',
                            'Appointment Reminder', 'Invoice for Your Recent Visit', 'Follow-up Consultation',
                            'Pre-Surgery Guidelines', 'Thank You for Choosing Us', 'Special Offer for Returning Patients'];
BEGIN
  FOR i IN 1..80 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    email_id := ('d000000a-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    -- Get patient name (simplified)
    fn := (SELECT first_name FROM patients WHERE id = patient_id);
    ln := (SELECT last_name FROM patients WHERE id = patient_id);
    
    INSERT INTO emails (
      id, patient_id, to_address, from_address, subject, body, status, direction, is_demo, created_at
    ) VALUES (
      email_id,
      patient_id,
      lower(coalesce(fn, 'patient')) || '.' || lower(coalesce(ln, 'demo')) || i || '@demo.com',
      'clinic@aliice.space',
      subjects[1 + (i % array_length(subjects, 1))],
      '<p>Dear ' || coalesce(fn, 'Patient') || ',</p><p>Thank you for choosing our clinic. ' ||
      'This is a demo email for testing purposes.</p><p>Best regards,<br>The Clinic Team</p>',
      (CASE WHEN i % 4 = 0 THEN 'draft' ELSE 'sent' END)::email_status,
      (CASE WHEN i % 5 = 0 THEN 'inbound' ELSE 'outbound' END)::email_direction,
      true,
      now() - ((40 - i % 40) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================
-- STEP 11: Generate Documents
-- =============================================
DO $$
DECLARE
  i int;
  patient_id uuid;
  doc_id uuid;
  doc_types text[] := ARRAY['other', 'report', 'post_op', 'other', 'report'];
  doc_titles text[] := ARRAY['Informed Consent Form', 'Treatment Report', 'Post-Operative Care Instructions',
                              'Pre-Operative Guidelines', 'Personalized Treatment Plan'];
BEGIN
  FOR i IN 1..50 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i * 2), 4, '0') || '-0000-0000-000000000001')::uuid;
    doc_id := ('d000000b-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO documents (
      id, patient_id, type, title, content, created_by, is_demo, created_at
    ) VALUES (
      doc_id,
      patient_id,
      doc_types[1 + (i % array_length(doc_types, 1))]::document_type,
      doc_titles[1 + (i % array_length(doc_titles, 1))],
      'DOCUMENT CONTENT\n\nThis is a demo document for patient #' || (i * 2) || '.\n\n' ||
      'Document Type: ' || doc_types[1 + (i % array_length(doc_types, 1))] || '\n\n' ||
      'Please review all information carefully and contact us with any questions.',
      'Demo System',
      true,
      now() - ((30 - i % 30) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the demo data was created:

-- SELECT 'patients' as table_name, count(*) as demo_records FROM patients WHERE is_demo = true
-- UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE is_demo = true
-- UNION ALL SELECT 'consultations', count(*) FROM consultations WHERE is_demo = true
-- UNION ALL SELECT 'deals', count(*) FROM deals WHERE is_demo = true
-- UNION ALL SELECT 'tasks', count(*) FROM tasks WHERE is_demo = true
-- UNION ALL SELECT 'emails', count(*) FROM emails WHERE is_demo = true
-- UNION ALL SELECT 'patient_notes', count(*) FROM patient_notes WHERE is_demo = true
-- UNION ALL SELECT 'documents', count(*) FROM documents WHERE is_demo = true
-- UNION ALL SELECT 'providers', count(*) FROM providers WHERE is_demo = true
-- UNION ALL SELECT 'deal_stages', count(*) FROM deal_stages WHERE is_demo = true;
