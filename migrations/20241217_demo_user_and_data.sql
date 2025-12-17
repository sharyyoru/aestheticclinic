-- This script creates demo user and sample demo data
-- Demo user: demo@aliice.space / demotest

-- Note: The demo user must be created in Supabase Auth first
-- Then we insert the user record with is_demo = true

-- Insert demo user into users table (requires auth.users entry to exist first)
-- You'll need to create this user in Supabase Auth with email: demo@aliice.space, password: demotest
-- Then run this to mark them as demo:
-- UPDATE users SET is_demo = true WHERE email = 'demo@aliice.space';

-- Create demo deal stages
insert into deal_stages (id, name, type, sort_order, is_default, is_demo)
values
  ('d1000000-0000-0000-0000-000000000001', 'Demo Lead', 'lead', 1, true, true),
  ('d1000000-0000-0000-0000-000000000002', 'Demo Consultation', 'consultation', 2, false, true),
  ('d1000000-0000-0000-0000-000000000003', 'Demo Surgery Scheduled', 'surgery', 3, false, true),
  ('d1000000-0000-0000-0000-000000000004', 'Demo Post-Op', 'post_op', 4, false, true),
  ('d1000000-0000-0000-0000-000000000005', 'Demo Follow-Up', 'follow_up', 5, false, true)
on conflict (id) do nothing;

-- Create demo providers
insert into providers (id, name, specialty, email, phone, is_demo)
values
  ('d2000000-0000-0000-0000-000000000001', 'Dr. Sarah Williams', 'Plastic Surgery', 'dr.williams@demo.clinic', '+1-555-0101', true),
  ('d2000000-0000-0000-0000-000000000002', 'Dr. Michael Chen', 'Dermatology', 'dr.chen@demo.clinic', '+1-555-0102', true),
  ('d2000000-0000-0000-0000-000000000003', 'Dr. Emily Rodriguez', 'Cosmetic Surgery', 'dr.rodriguez@demo.clinic', '+1-555-0103', true)
on conflict (id) do nothing;

-- Create demo patients
insert into patients (id, first_name, last_name, email, phone, gender, dob, marital_status, nationality, street_address, postal_code, town, profession, source, notes, lifecycle_stage, is_demo, created_at)
values
  ('d3000000-0000-0000-0000-000000000001', 'Emma', 'Thompson', 'emma.thompson@demo.com', '+1-555-1001', 'female', '1985-03-15', 'married', 'American', '123 Oak Street', '10001', 'New York', 'Marketing Manager', 'google', 'Interested in facial rejuvenation', 'consultation', true, now() - interval '30 days'),
  ('d3000000-0000-0000-0000-000000000002', 'James', 'Anderson', 'james.anderson@demo.com', '+1-555-1002', 'male', '1978-07-22', 'single', 'American', '456 Maple Avenue', '10002', 'New York', 'Software Engineer', 'manual', 'Looking for hair restoration', 'lead', true, now() - interval '15 days'),
  ('d3000000-0000-0000-0000-000000000003', 'Sophia', 'Martinez', 'sophia.martinez@demo.com', '+1-555-1003', 'female', '1990-11-08', 'married', 'American', '789 Pine Road', '10003', 'New York', 'Attorney', 'meta', 'Breast augmentation consultation', 'surgery', true, now() - interval '45 days'),
  ('d3000000-0000-0000-0000-000000000004', 'Oliver', 'Davis', 'oliver.davis@demo.com', '+1-555-1004', 'male', '1982-05-30', 'married', 'American', '321 Elm Street', '10004', 'New York', 'Business Owner', 'event', 'Rhinoplasty inquiry', 'consultation', true, now() - interval '7 days'),
  ('d3000000-0000-0000-0000-000000000005', 'Isabella', 'Wilson', 'isabella.wilson@demo.com', '+1-555-1005', 'female', '1995-09-12', 'single', 'American', '654 Birch Lane', '10005', 'New York', 'Interior Designer', 'google', 'Lip filler consultation', 'lead', true, now() - interval '3 days')
on conflict (id) do nothing;

-- Create demo appointments
insert into appointments (id, patient_id, provider_id, start_time, end_time, status, reason, location, source, is_demo, created_at)
values
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', now() + interval '3 days' + interval '10 hours', now() + interval '3 days' + interval '11 hours', 'scheduled', 'Facial consultation', 'Main Clinic', 'manual', true, now() - interval '2 days'),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000003', now() + interval '7 days' + interval '14 hours', now() + interval '7 days' + interval '15 hours', 'confirmed', 'Pre-surgery consultation', 'Main Clinic', 'manual', true, now() - interval '5 days'),
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000001', now() - interval '2 days' + interval '9 hours', now() - interval '2 days' + interval '10 hours', 'completed', 'Initial consultation', 'Main Clinic', 'manual', true, now() - interval '3 days'),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000002', now() + interval '1 day' + interval '15 hours', now() + interval '1 day' + interval '16 hours', 'scheduled', 'Lip filler consultation', 'Main Clinic', 'manual', true, now())
on conflict (id) do nothing;

-- Create demo deals
insert into deals (id, patient_id, stage_id, title, value, notes, is_demo, created_at, updated_at)
values
  ('d5000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'Facial Rejuvenation Package', 5500.00, 'Includes Botox and dermal fillers', true, now() - interval '20 days', now() - interval '5 days'),
  ('d5000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', 'Breast Augmentation', 8500.00, 'Surgery scheduled for next month', true, now() - interval '40 days', now() - interval '2 days'),
  ('d5000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'Rhinoplasty Consultation', 7200.00, 'Waiting for insurance approval', true, now() - interval '7 days', now() - interval '1 day'),
  ('d5000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'Lip Filler Treatment', 850.00, 'First-time patient', true, now() - interval '2 days', now())
on conflict (id) do nothing;

-- Create demo tasks
insert into tasks (id, patient_id, name, content, status, priority, type, activity_date, is_demo, created_at)
values
  ('d6000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'Follow up on consultation', 'Call patient to confirm treatment plan', 'not_started', 'high', 'call', now() + interval '1 day', true, now()),
  ('d6000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000003', 'Send pre-surgery instructions', 'Email patient with pre-op guidelines', 'in_progress', 'high', 'email', now() + interval '2 days', true, now() - interval '1 day'),
  ('d6000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004', 'Schedule follow-up appointment', 'Book 2-week post-consultation check', 'completed', 'medium', 'todo', now() - interval '1 day', true, now() - interval '2 days'),
  ('d6000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000005', 'Verify insurance coverage', 'Check if procedure is covered', 'not_started', 'medium', 'todo', now() + interval '3 days', true, now())
on conflict (id) do nothing;

-- Create demo emails
insert into emails (id, patient_id, deal_id, to_address, from_address, subject, body, status, direction, is_demo, created_at)
values
  ('d7000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'emma.thompson@demo.com', 'clinic@demo.clinic', 'Your Upcoming Consultation', 'Dear Emma, We are looking forward to seeing you for your facial consultation...', 'sent', 'outbound', true, now() - interval '2 days'),
  ('d7000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000003', 'd5000000-0000-0000-0000-000000000002', 'sophia.martinez@demo.com', 'clinic@demo.clinic', 'Pre-Surgery Instructions', 'Dear Sophia, Please review these important pre-surgery guidelines...', 'sent', 'outbound', true, now() - interval '5 days'),
  ('d7000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004', null, 'oliver.davis@demo.com', 'clinic@demo.clinic', 'Thank You for Your Consultation', 'Dear Oliver, Thank you for visiting our clinic...', 'draft', 'outbound', true, now())
on conflict (id) do nothing;

-- Create demo patient notes
insert into patient_notes (id, patient_id, author_name, body, is_demo, created_at)
values
  ('d8000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'Demo Staff', 'Patient is very interested in non-surgical options. Discussed Botox and filler options.', true, now() - interval '10 days'),
  ('d8000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000003', 'Demo Staff', 'Patient has realistic expectations. Surgery scheduled for next month.', true, now() - interval '15 days'),
  ('d8000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004', 'Demo Staff', 'Patient needs to provide updated insurance information before proceeding.', true, now() - interval '3 days')
on conflict (id) do nothing;

-- Create demo documents
insert into documents (id, patient_id, deal_id, type, title, content, created_by, is_demo, created_at)
values
  ('d9000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000003', 'd5000000-0000-0000-0000-000000000002', 'post_op', 'Post-Surgery Care Instructions', 'POST-OPERATIVE CARE INSTRUCTIONS\n\nDay 1-3:\n- Take prescribed medications as directed\n- Keep surgical area clean and dry\n- Rest and avoid strenuous activity\n\nDay 4-7:\n- Light walking is encouraged\n- Continue medication regimen\n- Watch for signs of infection\n\nWeek 2-4:\n- Follow-up appointment scheduled\n- Gradual return to normal activities\n- Avoid heavy lifting', 'Demo System', true, now() - interval '5 days'),
  ('d9000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'report', 'Treatment Plan Report', 'TREATMENT PLAN SUMMARY\n\nPatient: Emma Thompson\nProcedure: Facial Rejuvenation\n\nRecommended treatments:\n1. Botox - forehead and crow''s feet\n2. Dermal fillers - nasolabial folds\n3. Chemical peel - full face\n\nEstimated cost: $5,500\nExpected results: Visible within 7-14 days\nDuration: 4-6 months', 'Demo System', true, now() - interval '8 days')
on conflict (id) do nothing;

-- Create demo email templates
insert into email_templates (id, name, type, subject_template, body_template, is_demo)
values
  ('da000000-0000-0000-0000-000000000001', 'Demo Welcome Email', 'patient', 'Welcome to Our Clinic, {{patient_name}}!', 'Dear {{patient_name}},\n\nThank you for choosing our clinic. We look forward to helping you achieve your aesthetic goals.\n\nBest regards,\nThe Clinic Team', true),
  ('da000000-0000-0000-0000-000000000002', 'Demo Appointment Reminder', 'patient', 'Reminder: Your Appointment on {{appointment_date}}', 'Dear {{patient_name}},\n\nThis is a friendly reminder about your upcoming appointment on {{appointment_date}} at {{appointment_time}}.\n\nPlease arrive 15 minutes early.\n\nBest regards,\nThe Clinic Team', true),
  ('da000000-0000-0000-0000-000000000003', 'Demo Insurance Request', 'insurance', 'Insurance Authorization Request for {{patient_name}}', 'To Whom It May Concern,\n\nWe are requesting authorization for the following procedure for our patient {{patient_name}}:\n\nProcedure: {{procedure_name}}\nEstimated Cost: {{procedure_cost}}\n\nPlease review and approve at your earliest convenience.\n\nSincerely,\nClinic Administrator', true)
on conflict (id) do nothing;
