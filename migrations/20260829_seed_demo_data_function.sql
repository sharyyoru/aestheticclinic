-- Seed Demo Data Function
-- Called by /api/demo/ensure-user to automatically populate demo data
-- This function is idempotent - safe to call multiple times

CREATE OR REPLACE FUNCTION seed_demo_data(demo_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  procedures text[] := ARRAY['Botox Treatment', 'Dermal Fillers', 'Chemical Peel', 'Microdermabrasion', 'Laser Treatment', 
                              'Rhinoplasty Consultation', 'Breast Augmentation', 'Liposuction', 'Facelift Consultation', 'Body Contouring'];
  amounts decimal[] := ARRAY[250, 500, 750, 1000, 1500, 2000, 2500, 3500, 5000, 7500, 10000, 15000];
  
  provider_ids uuid[] := ARRAY[
    'd0000001-0001-0000-0000-000000000001'::uuid,
    'd0000001-0002-0000-0000-000000000002'::uuid,
    'd0000001-0003-0000-0000-000000000003'::uuid,
    'd0000001-0004-0000-0000-000000000004'::uuid,
    'd0000001-0005-0000-0000-000000000005'::uuid
  ];
  
  stage_ids uuid[] := ARRAY[
    'd0000002-0001-0000-0000-000000000001'::uuid,
    'd0000002-0002-0000-0000-000000000002'::uuid,
    'd0000002-0003-0000-0000-000000000003'::uuid,
    'd0000002-0004-0000-0000-000000000004'::uuid,
    'd0000002-0005-0000-0000-000000000005'::uuid,
    'd0000002-0006-0000-0000-000000000006'::uuid
  ];
  
  i int;
  j int;
  patient_id uuid;
  fn text;
  ln text;
  existing_count int;
  result jsonb;
BEGIN
  -- Check if demo data already exists
  SELECT count(*) INTO existing_count FROM patients WHERE is_demo = true;
  IF existing_count >= 100 THEN
    RETURN jsonb_build_object('status', 'already_seeded', 'patient_count', existing_count);
  END IF;

  -- =============================================
  -- STEP 1: Create Demo Providers
  -- =============================================
  INSERT INTO providers (id, name, specialty, email, phone, is_demo)
  VALUES
    ('d0000001-0001-0000-0000-000000000001', 'Dr. Carlos Mendez', 'Plastic Surgery', 'dr.mendez@demo.clinic', '+41-22-555-0101', true),
    ('d0000001-0002-0000-0000-000000000002', 'Dr. Maria Santos', 'Dermatology', 'dr.santos@demo.clinic', '+41-22-555-0102', true),
    ('d0000001-0003-0000-0000-000000000003', 'Dr. Roberto Vega', 'Cosmetic Surgery', 'dr.vega@demo.clinic', '+41-22-555-0103', true),
    ('d0000001-0004-0000-0000-000000000004', 'Dr. Ana Gutierrez', 'Aesthetic Medicine', 'dr.gutierrez@demo.clinic', '+41-22-555-0104', true),
    ('d0000001-0005-0000-0000-000000000005', 'Dr. Luis Paredes', 'Reconstructive Surgery', 'dr.paredes@demo.clinic', '+41-22-555-0105', true)
  ON CONFLICT (id) DO NOTHING;

  -- =============================================
  -- STEP 2: Create Demo Deal Stages
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
  -- STEP 3: Generate 100 Demo Patients
  -- =============================================
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    fn := first_names[1 + (i % array_length(first_names, 1))];
    ln := last_names[1 + ((i * 3) % array_length(last_names, 1))];
    
    INSERT INTO patients (
      id, first_name, last_name, email, phone, gender, dob, 
      marital_status, nationality, street_address, postal_code, town,
      profession, source, notes, lifecycle_stage, is_demo, created_at
    ) VALUES (
      patient_id, fn, ln, 
      lower(fn) || '.' || lower(ln) || i || '@demo.com',
      '+41-79-' || lpad((1000000 + i * 1234)::text, 7, '0'),
      genders[1 + (i % array_length(genders, 1))],
      '1965-01-01'::date + (i * 150 || ' days')::interval,
      CASE WHEN i % 3 = 0 THEN 'married' WHEN i % 3 = 1 THEN 'single' ELSE 'divorced' END,
      'Swiss',
      i || ' Rue de la Clinique, Suite ' || (i % 20 + 1),
      '12' || lpad((i % 100)::text, 2, '0'),
      CASE WHEN i % 3 = 0 THEN 'Geneva' WHEN i % 3 = 1 THEN 'Zurich' ELSE 'Lausanne' END,
      professions[1 + (i % array_length(professions, 1))],
      sources[1 + (i % array_length(sources, 1))],
      'Demo patient #' || i || ' - interested in aesthetic procedures',
      stages[1 + (i % array_length(stages, 1))],
      true,
      now() - ((100 - i) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- =============================================
  -- STEP 4: Generate Appointments
  -- =============================================
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    FOR j IN 1..(1 + (i % 3)) LOOP
      INSERT INTO appointments (
        id, patient_id, provider_id, start_time, end_time, status, reason, location, source, is_demo, created_at
      ) VALUES (
        ('d0000004-' || lpad(to_hex(i), 4, '0') || '-000' || j::text || '-0000-000000000001')::uuid,
        patient_id,
        provider_ids[1 + (i % 5)],
        CASE 
          WHEN j = 1 THEN now() - ((30 - i % 30) || ' days')::interval + ((9 + (i % 8)) || ' hours')::interval
          WHEN j = 2 THEN now() + ((i % 14) || ' days')::interval + ((10 + (i % 6)) || ' hours')::interval
          ELSE now() + ((14 + i % 21) || ' days')::interval + ((9 + (i % 9)) || ' hours')::interval
        END,
        CASE 
          WHEN j = 1 THEN now() - ((30 - i % 30) || ' days')::interval + ((10 + (i % 8)) || ' hours')::interval
          WHEN j = 2 THEN now() + ((i % 14) || ' days')::interval + ((11 + (i % 6)) || ' hours')::interval
          ELSE now() + ((14 + i % 21) || ' days')::interval + ((10 + (i % 9)) || ' hours')::interval
        END,
        CASE WHEN j = 1 THEN 'completed' WHEN j = 2 AND i % 4 = 0 THEN 'confirmed' ELSE 'scheduled' END::appointment_status,
        CASE (i + j) % 7
          WHEN 0 THEN 'Initial Consultation'
          WHEN 1 THEN 'Follow-up'
          WHEN 2 THEN 'Pre-Surgery Assessment'
          WHEN 3 THEN 'Post-Op Check'
          WHEN 4 THEN 'Treatment Session'
          WHEN 5 THEN 'Botox Appointment'
          ELSE 'Filler Consultation'
        END,
        CASE WHEN i % 2 = 0 THEN 'Aesthetics Clinic Geneva' ELSE 'Aesthetics Clinic Zurich' END,
        'manual',
        true,
        now() - ((40 - i % 40) || ' days')::interval
      ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- =============================================
  -- STEP 5: Generate Consultations & Invoices
  -- =============================================
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    -- Create consultation record
    INSERT INTO consultations (
      id, patient_id, consultation_id, title, content, record_type,
      doctor_name, scheduled_at, duration_seconds,
      created_by_name, is_archived, is_demo, created_at
    ) VALUES (
      ('d0000005-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid,
      patient_id,
      'CONS-DEMO-' || lpad(i::text, 5, '0'),
      procedures[1 + (i % array_length(procedures, 1))] || ' - Consultation',
      '<h3>Clinical Notes</h3><p>Patient presented for ' || procedures[1 + (i % array_length(procedures, 1))] || 
      ' consultation.</p><p><strong>Assessment:</strong> Patient is a good candidate for the procedure.</p>' ||
      '<p><strong>Plan:</strong> Scheduled follow-up and provided pre-procedure instructions.</p>',
      'notes'::consultation_record_type,
      CASE i % 5
        WHEN 0 THEN 'Dr. Carlos Mendez'
        WHEN 1 THEN 'Dr. Maria Santos'
        WHEN 2 THEN 'Dr. Roberto Vega'
        WHEN 3 THEN 'Dr. Ana Gutierrez'
        ELSE 'Dr. Luis Paredes'
      END,
      now() - ((60 - i % 60) || ' days')::interval,
      1800 + (i * 60),
      'Demo Staff',
      false,
      true,
      now() - ((60 - i % 60) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create invoice for 80% of patients
    IF i % 5 != 0 THEN
      INSERT INTO consultations (
        id, patient_id, consultation_id, title, content, record_type,
        doctor_name, scheduled_at, payment_method, 
        invoice_total_amount, invoice_is_complimentary, invoice_is_paid,
        created_by_name, is_archived, is_demo, created_at
      ) VALUES (
        ('d0000006-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid,
        patient_id,
        'INV-DEMO-' || lpad(i::text, 5, '0'),
        'Invoice - ' || procedures[1 + (i % array_length(procedures, 1))],
        '<h3>Invoice Details</h3><p><strong>Service:</strong> ' || procedures[1 + (i % array_length(procedures, 1))] || 
        '</p><p><strong>Description:</strong> Professional aesthetic services as discussed during consultation.</p>' ||
        '<p><strong>Total:</strong> CHF ' || amounts[1 + (i % array_length(amounts, 1))] || '</p>',
        'invoice'::consultation_record_type,
        CASE i % 4
          WHEN 1 THEN 'Dr. Carlos Mendez'
          WHEN 2 THEN 'Dr. Maria Santos'
          WHEN 3 THEN 'Dr. Roberto Vega'
          ELSE 'Dr. Ana Gutierrez'
        END,
        now() - ((53 - i % 53) || ' days')::interval,
        CASE i % 3 WHEN 0 THEN 'Cash' WHEN 1 THEN 'Online Payment' ELSE 'Bank transfer' END,
        amounts[1 + (i % array_length(amounts, 1))],
        false,
        CASE WHEN i % 4 != 0 THEN true ELSE false END,
        'Demo Staff',
        false,
        true,
        now() - ((53 - i % 53) || ' days')::interval
      ) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  -- =============================================
  -- STEP 6: Generate Deals
  -- =============================================
  FOR i IN 1..70 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO deals (
      id, patient_id, stage_id, title, value, notes, is_demo, created_at, updated_at
    ) VALUES (
      ('d0000007-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid,
      patient_id,
      stage_ids[1 + (i % 6)],
      CASE i % 10
        WHEN 0 THEN 'Facial Rejuvenation Package'
        WHEN 1 THEN 'Body Contouring Treatment'
        WHEN 2 THEN 'Rhinoplasty Procedure'
        WHEN 3 THEN 'Breast Augmentation'
        WHEN 4 THEN 'Lip Enhancement'
        WHEN 5 THEN 'Full Facelift'
        WHEN 6 THEN 'Liposuction Package'
        WHEN 7 THEN 'Botox Treatment Plan'
        WHEN 8 THEN 'Dermal Filler Series'
        ELSE 'Laser Skin Resurfacing'
      END,
      CASE i % 10
        WHEN 0 THEN 1500 WHEN 1 THEN 2500 WHEN 2 THEN 5000 WHEN 3 THEN 7500 WHEN 4 THEN 10000
        WHEN 5 THEN 12000 WHEN 6 THEN 15000 WHEN 7 THEN 20000 WHEN 8 THEN 25000 ELSE 35000
      END,
      'Demo deal for patient #' || i,
      true,
      now() - ((70 - i) || ' days')::interval,
      now() - ((i % 10) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- =============================================
  -- STEP 7: Generate Tasks
  -- =============================================
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO tasks (
      id, patient_id, name, content, status, priority, type, activity_date, 
      created_by_name, is_demo, created_at
    ) VALUES (
      ('d0000008-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid,
      patient_id,
      CASE i % 10
        WHEN 0 THEN 'Follow up call'
        WHEN 1 THEN 'Send treatment plan'
        WHEN 2 THEN 'Schedule appointment'
        WHEN 3 THEN 'Verify insurance'
        WHEN 4 THEN 'Send pre-op instructions'
        WHEN 5 THEN 'Post-op check reminder'
        WHEN 6 THEN 'Payment follow-up'
        WHEN 7 THEN 'Review lab results'
        WHEN 8 THEN 'Update patient records'
        ELSE 'Confirm consultation'
      END,
      'Demo task for patient #' || i,
      CASE i % 3 WHEN 0 THEN 'not_started' WHEN 1 THEN 'in_progress' ELSE 'completed' END::task_status,
      CASE i % 3 WHEN 0 THEN 'low' WHEN 1 THEN 'medium' ELSE 'high' END::task_priority,
      CASE i % 4 WHEN 0 THEN 'todo' WHEN 1 THEN 'call' WHEN 2 THEN 'email' ELSE 'other' END::task_type,
      now() + ((-10 + i % 20) || ' days')::interval,
      'Demo Staff',
      true,
      now() - ((50 - i % 50) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- =============================================
  -- STEP 8: Generate Emails
  -- =============================================
  FOR i IN 1..80 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    fn := first_names[1 + (i % array_length(first_names, 1))];
    ln := last_names[1 + ((i * 3) % array_length(last_names, 1))];
    
    INSERT INTO emails (
      id, patient_id, to_address, from_address, subject, body, status, direction, is_demo, created_at
    ) VALUES (
      ('d000000a-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid,
      patient_id,
      lower(fn) || '.' || lower(ln) || i || '@demo.com',
      'clinic@aliice.com',
      CASE i % 9
        WHEN 0 THEN 'Your Upcoming Appointment'
        WHEN 1 THEN 'Treatment Plan Information'
        WHEN 2 THEN 'Post-Procedure Care Instructions'
        WHEN 3 THEN 'Appointment Reminder'
        WHEN 4 THEN 'Invoice for Your Recent Visit'
        WHEN 5 THEN 'Follow-up Consultation'
        WHEN 6 THEN 'Pre-Surgery Guidelines'
        WHEN 7 THEN 'Thank You for Choosing Us'
        ELSE 'Special Offer for Returning Patients'
      END,
      '<p>Dear ' || fn || ',</p><p>Thank you for choosing our clinic. This is a demo email for testing purposes.</p><p>Best regards,<br>The Clinic Team</p>',
      CASE WHEN i % 4 = 0 THEN 'draft' ELSE 'sent' END::email_status,
      CASE WHEN i % 5 = 0 THEN 'inbound' ELSE 'outbound' END::email_direction,
      true,
      now() - ((40 - i % 40) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- =============================================
  -- STEP 9: Generate Patient Notes
  -- =============================================
  FOR i IN 1..100 LOOP
    patient_id := ('d0000003-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid;
    
    INSERT INTO patient_notes (
      id, patient_id, author_name, body, is_demo, created_at
    ) VALUES (
      ('d0000009-' || lpad(to_hex(i), 4, '0') || '-0000-0000-000000000001')::uuid,
      patient_id,
      CASE i % 5
        WHEN 0 THEN 'Dr. Carlos Mendez'
        WHEN 1 THEN 'Dr. Maria Santos'
        WHEN 2 THEN 'Dr. Roberto Vega'
        WHEN 3 THEN 'Nurse Ana'
        ELSE 'Reception Staff'
      END,
      CASE i % 10
        WHEN 0 THEN 'Patient interested in facial rejuvenation options. Discussed Botox and filler treatments.'
        WHEN 1 THEN 'Reviewed medical history. No contraindications for proposed procedure.'
        WHEN 2 THEN 'Patient has realistic expectations. Scheduled for pre-operative assessment.'
        WHEN 3 THEN 'Follow-up consultation completed. Patient satisfied with initial results.'
        WHEN 4 THEN 'Discussed payment options and treatment timeline.'
        WHEN 5 THEN 'Patient inquired about recovery time and post-procedure care.'
        WHEN 6 THEN 'Provided detailed information about procedure risks and benefits.'
        WHEN 7 THEN 'Patient needs to complete blood work before scheduling surgery.'
        WHEN 8 THEN 'Insurance pre-authorization submitted. Awaiting response.'
        ELSE 'Post-op day 7: Healing well, no complications noted.'
      END,
      true,
      now() - ((60 - i % 60) || ' days')::interval
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- =============================================
  -- STEP 10: Create Email Templates
  -- =============================================
  INSERT INTO email_templates (id, name, type, subject_template, body_template, is_demo)
  VALUES
    ('d1000001-0001-0000-0000-000000000001', 'Appointment Confirmation', 'workflow',
     'Your Appointment at Aesthetics Clinic - {{appointment.date}}',
     E'Dear {{patient.first_name}},\n\nThank you for booking your appointment!\n\n**Appointment Details:**\n* Date: {{appointment.date}}\n* Time: {{appointment.time}}\n* Doctor: {{appointment.provider_name}}\n\nPlease arrive 10 minutes early.\n\nBest regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0002-0000-0000-000000000001', 'Appointment Reminder - 24h', 'workflow',
     'Reminder: Your Appointment Tomorrow',
     E'Dear {{patient.first_name}},\n\nThis is a friendly reminder about your appointment tomorrow.\n\n**What to Bring:**\n* Photo ID\n* Insurance card\n* List of current medications\n\nSee you tomorrow!\n\nBest regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0003-0000-0000-000000000001', 'Post-Consultation Follow-up', 'workflow',
     'Thank You for Your Consultation - Next Steps',
     E'Dear {{patient.first_name}},\n\nThank you for visiting Aesthetics Clinic today.\n\n**Next Steps:**\n* Review the treatment plan\n* Contact us with any questions\n* Schedule your procedure when ready\n\nWarm regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0004-0000-0000-000000000001', 'New Lead Welcome', 'workflow',
     'Welcome to Aesthetics Clinic - Your Journey Begins',
     E'Dear {{patient.first_name}},\n\nWelcome to Aesthetics Clinic! We''re thrilled that you''ve chosen us.\n\n**What We Offer:**\n* Facial Rejuvenation\n* Body Contouring\n* Breast Procedures\n* Non-Surgical Treatments\n\nBook your free consultation today!\n\nBest regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0005-0000-0000-000000000001', 'Treatment Quote', 'workflow',
     'Your Personalized Quote - {{deal.procedure_name}}',
     E'Dear {{patient.first_name}},\n\nPlease find your personalized quote below.\n\n**Quote Details:**\n* All fees included\n* Post-op care included\n* Valid for 30 days\n\nReady to proceed? Reply to this email.\n\nWarm regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0006-0000-0000-000000000001', 'Surgery Confirmation', 'workflow',
     'Your Surgery is Scheduled - Important Information',
     E'Dear {{patient.first_name}},\n\nYour surgery has been scheduled!\n\n**Pre-Surgery Instructions:**\n* No eating 8 hours before\n* Arrange transportation home\n* Wear comfortable clothing\n\nWishing you a smooth surgery!\n\nBest regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0007-0000-0000-000000000001', 'Post-Surgery Care', 'workflow',
     'Your Recovery Guide - Post-Surgery Care',
     E'Dear {{patient.first_name}},\n\nCongratulations on completing your procedure!\n\n**Recovery Timeline:**\n* Days 1-3: Rest\n* Days 4-7: Light activity\n* Weeks 2-4: Return to activities\n\nWe''re here for you!\n\nWarm regards,\nThe Aesthetics Clinic Team', true),
    ('d1000001-0008-0000-0000-000000000001', 'Satisfaction Survey', 'workflow',
     'How Was Your Experience? We Value Your Feedback',
     E'Dear {{patient.first_name}},\n\nWe hope you''re enjoying your results!\n\n**We''d Love to Hear From You:**\n* How satisfied are you?\n* Would you recommend us?\n\nThank you for choosing us!\n\nWith appreciation,\nThe Aesthetics Clinic Team', true)
  ON CONFLICT (id) DO NOTHING;

  -- =============================================
  -- STEP 11: Create Workflows
  -- =============================================
  INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
  VALUES
    ('d2000001-0001-0000-0000-000000000001', 'New Patient Welcome', 'patient_created', true,
     '{"nodes":[{"id":"trigger-1","type":"trigger","data":{"label":"New Patient Created"}},{"id":"delay-1","type":"delay","data":{"config":{"delay_minutes":5}}},{"id":"action-1","type":"action","data":{"action_type":"send_email","config":{"template_id":"d1000001-0004-0000-0000-000000000001"}}}],"edges":[{"source":"trigger-1","target":"delay-1"},{"source":"delay-1","target":"action-1"}]}'::jsonb, true),
    ('d2000001-0002-0000-0000-000000000001', 'Appointment Confirmation', 'appointment_created', true,
     '{"nodes":[{"id":"trigger-1","type":"trigger","data":{"label":"Appointment Booked"}},{"id":"action-1","type":"action","data":{"action_type":"send_email","config":{"template_id":"d1000001-0001-0000-0000-000000000001"}}}],"edges":[{"source":"trigger-1","target":"action-1"}]}'::jsonb, true),
    ('d2000001-0003-0000-0000-000000000001', 'Appointment Reminder - 24h', 'appointment_reminder', true,
     '{"nodes":[{"id":"trigger-1","type":"trigger","data":{"label":"24 Hours Before"}},{"id":"action-1","type":"action","data":{"action_type":"send_email","config":{"template_id":"d1000001-0002-0000-0000-000000000001"}}}],"edges":[{"source":"trigger-1","target":"action-1"}]}'::jsonb, true),
    ('d2000001-0004-0000-0000-000000000001', 'Quote Sent', 'deal_stage_changed', true,
     '{"nodes":[{"id":"trigger-1","type":"trigger","data":{"label":"Deal to Proposal Sent"}},{"id":"action-1","type":"action","data":{"action_type":"send_email","config":{"template_id":"d1000001-0005-0000-0000-000000000001"}}}],"edges":[{"source":"trigger-1","target":"action-1"}]}'::jsonb, true),
    ('d2000001-0005-0000-0000-000000000001', 'Post-Consultation Follow-up', 'consultation_completed', true,
     '{"nodes":[{"id":"trigger-1","type":"trigger","data":{"label":"Consultation Completed"}},{"id":"delay-1","type":"delay","data":{"config":{"delay_minutes":120}}},{"id":"action-1","type":"action","data":{"action_type":"send_email","config":{"template_id":"d1000001-0003-0000-0000-000000000001"}}}],"edges":[{"source":"trigger-1","target":"delay-1"},{"source":"delay-1","target":"action-1"}]}'::jsonb, true),
    ('d2000001-0006-0000-0000-000000000001', 'Surgery Confirmation', 'deal_stage_changed', true,
     '{"nodes":[{"id":"trigger-1","type":"trigger","data":{"label":"Surgery Scheduled"}},{"id":"action-1","type":"action","data":{"action_type":"send_email","config":{"template_id":"d1000001-0006-0000-0000-000000000001"}}}],"edges":[{"source":"trigger-1","target":"action-1"}]}'::jsonb, true)
  ON CONFLICT (id) DO NOTHING;

  -- Return summary
  SELECT jsonb_build_object(
    'status', 'seeded',
    'patients', (SELECT count(*) FROM patients WHERE is_demo = true),
    'appointments', (SELECT count(*) FROM appointments WHERE is_demo = true),
    'consultations', (SELECT count(*) FROM consultations WHERE is_demo = true),
    'deals', (SELECT count(*) FROM deals WHERE is_demo = true),
    'tasks', (SELECT count(*) FROM tasks WHERE is_demo = true),
    'emails', (SELECT count(*) FROM emails WHERE is_demo = true),
    'workflows', (SELECT count(*) FROM workflows WHERE is_demo = true),
    'email_templates', (SELECT count(*) FROM email_templates WHERE is_demo = true)
  ) INTO result;
  
  RETURN result;
END;
$$;
