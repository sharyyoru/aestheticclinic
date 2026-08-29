-- Demo Workflow Email Templates and Workflows
-- For demo@aliice.com demo account
-- Creates workflow email templates for common aesthetic clinic scenarios

-- =============================================
-- STEP 1: Create Demo Email Templates
-- =============================================

-- Appointment Confirmation Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0001-0000-0000-000000000001',
  'Appointment Confirmation',
  'workflow',
  'Your Appointment at Aesthetics Clinic - {{appointment.date}}',
  E'Dear {{patient.first_name}},\n\nThank you for booking your appointment with us!\n\n**Appointment Details:**\n* Date: {{appointment.date}}\n* Time: {{appointment.time}}\n* Doctor: {{appointment.provider_name}}\n* Service: {{appointment.service}}\n* Location: {{appointment.location}}\n\nPlease arrive 10 minutes early to complete any necessary paperwork.\n\nIf you need to reschedule, please contact us at least 24 hours in advance.\n\nWe look forward to seeing you!\n\nBest regards,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- Appointment Reminder Template (24h before)
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0002-0000-0000-000000000001',
  'Appointment Reminder - 24h',
  'workflow',
  'Reminder: Your Appointment Tomorrow - {{appointment.date}}',
  E'Dear {{patient.first_name}},\n\nThis is a friendly reminder that you have an appointment scheduled for tomorrow.\n\n**Appointment Details:**\n* Date: {{appointment.date}}\n* Time: {{appointment.time}}\n* Doctor: {{appointment.provider_name}}\n* Service: {{appointment.service}}\n\n**What to Bring:**\n* Photo ID\n* Insurance card (if applicable)\n* List of current medications\n\nIf you cannot make it, please let us know as soon as possible.\n\nSee you tomorrow!\n\nBest regards,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- Post-Consultation Follow-up Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0003-0000-0000-000000000001',
  'Post-Consultation Follow-up',
  'workflow',
  'Thank You for Your Consultation - Next Steps',
  E'Dear {{patient.first_name}},\n\nThank you for visiting Aesthetics Clinic today. We hope your consultation was informative and helpful.\n\n**Summary of Your Visit:**\nDuring your consultation, we discussed your goals and the best treatment options for you. Our team is here to support you every step of the way.\n\n**Next Steps:**\n* Review the treatment plan we discussed\n* Contact us with any questions\n* Schedule your procedure when ready\n\n**Your Personalized Quote:**\nWe will send you a detailed quote for your chosen procedures within 24 hours.\n\nIf you have any questions or would like to proceed, please don''t hesitate to reach out.\n\nWarm regards,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- New Lead Welcome Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0004-0000-0000-000000000001',
  'New Lead Welcome',
  'workflow',
  'Welcome to Aesthetics Clinic - Your Journey Begins',
  E'Dear {{patient.first_name}},\n\nWelcome to Aesthetics Clinic! We''re thrilled that you''ve chosen to explore your aesthetic journey with us.\n\n**About Us:**\nWith over 20 years of experience, our team of board-certified surgeons and specialists are dedicated to helping you achieve your aesthetic goals safely and beautifully.\n\n**What We Offer:**\n* Facial Rejuvenation (Botox, Fillers, Facelifts)\n* Body Contouring (Liposuction, Tummy Tuck)\n* Breast Procedures (Augmentation, Lift, Reduction)\n* Non-Surgical Treatments (Laser, Skin Care)\n\n**Book Your Free Consultation:**\nLet us understand your goals and create a personalized treatment plan just for you.\n\nReply to this email or call us to schedule your complimentary consultation.\n\nLooking forward to meeting you!\n\nBest regards,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch\nBook Online: https://aestheticclinic.vercel.app/book-appointment/location',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- Quote/Proposal Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0005-0000-0000-000000000001',
  'Treatment Quote',
  'workflow',
  'Your Personalized Quote - {{deal.procedure_name}}',
  E'Dear {{patient.first_name}},\n\nFollowing your consultation, we are pleased to provide you with a detailed quote for your requested procedure.\n\n**Procedure:** {{deal.procedure_name}}\n\n**Quote Details:**\n* Surgeon''s Fee: Included\n* Anesthesia: Included\n* Facility Fee: Included\n* Post-Op Care: Included\n* Follow-up Visits (1 year): Included\n\n**Total Investment:** {{deal.value}} CHF\n\n**Payment Options:**\n* Full payment at time of booking (5% discount)\n* 50% deposit, balance before surgery\n* Financing available (up to 36 months)\n\n**Quote Validity:** This quote is valid for 30 days.\n\nReady to proceed? Reply to this email or call us to book your surgery date.\n\nWarm regards,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- Surgery Scheduled Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0006-0000-0000-000000000001',
  'Surgery Confirmation',
  'workflow',
  'Your Surgery is Scheduled - Important Information',
  E'Dear {{patient.first_name}},\n\nGreat news! Your surgery has been scheduled. Please review the important information below.\n\n**Surgery Details:**\n* Date: {{appointment.date}}\n* Time: {{appointment.time}} (please arrive 1 hour early)\n* Procedure: {{deal.procedure_name}}\n* Surgeon: {{appointment.provider_name}}\n\n**Pre-Surgery Instructions:**\n* No eating or drinking 8 hours before surgery\n* Stop blood thinners 7 days before (with doctor approval)\n* Arrange for someone to drive you home\n* Wear comfortable, loose-fitting clothing\n\n**What to Bring:**\n* Photo ID\n* Insurance documents\n* Comfortable clothes for going home\n* Prescription medications (if any)\n\n**Post-Surgery:**\nYou will receive detailed aftercare instructions after your procedure.\n\nIf you have any questions, please don''t hesitate to contact us.\n\nWishing you a smooth surgery and speedy recovery!\n\nBest regards,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- Post-Surgery Care Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0007-0000-0000-000000000001',
  'Post-Surgery Care Instructions',
  'workflow',
  'Your Recovery Guide - Post-Surgery Care',
  E'Dear {{patient.first_name}},\n\nCongratulations on completing your procedure! Your journey to your new look has begun.\n\n**Recovery Timeline:**\n* Days 1-3: Rest and initial healing\n* Days 4-7: Light activity, reduced swelling\n* Weeks 2-4: Return to most activities\n* Months 2-3: Final results visible\n\n**Care Instructions:**\n* Keep the surgical area clean and dry\n* Take prescribed medications as directed\n* Wear compression garments if provided\n* Avoid strenuous activity for 2-4 weeks\n* Attend all follow-up appointments\n\n**Warning Signs (Contact Us Immediately):**\n* Fever above 38.5°C\n* Excessive bleeding or discharge\n* Severe pain not relieved by medication\n* Signs of infection (redness, warmth, pus)\n\n**Your Follow-up Appointments:**\nWe will contact you to schedule your post-op visits.\n\nRemember, we''re here for you throughout your recovery.\n\nWarm regards,\nThe Aesthetics Clinic Team\n\n---\n24/7 Emergency Line: +41 22 732 22 99\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- Satisfaction Survey Template
INSERT INTO email_templates (id, name, type, subject_template, body_template, html_content, is_demo)
VALUES (
  'd1000001-0008-0000-0000-000000000001',
  'Satisfaction Survey',
  'workflow',
  'How Was Your Experience? We Value Your Feedback',
  E'Dear {{patient.first_name}},\n\nWe hope you''re enjoying your results! Your feedback is incredibly valuable to us and helps us continue providing exceptional care.\n\n**We''d Love to Hear From You:**\n* How satisfied are you with your results?\n* How was your experience with our team?\n* Would you recommend us to friends and family?\n\n**Share Your Story:**\nIf you''re comfortable, we''d be honored if you shared your experience. Your testimonial could help others on their aesthetic journey.\n\n**Refer a Friend:**\nReceive CHF 500 credit toward your next treatment when you refer a friend who books a procedure.\n\nThank you for choosing Aesthetics Clinic. We''re grateful for your trust.\n\nWith appreciation,\nThe Aesthetics Clinic Team\n\n---\nMain Telephone: +41 22 732 22 23\nEmail: info@aesthetics-ge.ch',
  NULL,
  true
) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STEP 2: Create Demo Workflows
-- =============================================

-- New Patient Welcome Workflow
INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
VALUES (
  'd2000001-0001-0000-0000-000000000001',
  'New Patient Welcome',
  'patient_created',
  true,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": { "label": "New Patient Created" }
      },
      {
        "id": "delay-1",
        "type": "delay",
        "data": { "config": { "delay_minutes": 5 } }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "action_type": "send_email",
          "config": {
            "template_id": "d1000001-0004-0000-0000-000000000001"
          }
        }
      }
    ],
    "edges": [
      { "source": "trigger-1", "target": "delay-1" },
      { "source": "delay-1", "target": "action-1" }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;

-- Appointment Confirmation Workflow
INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
VALUES (
  'd2000001-0002-0000-0000-000000000001',
  'Appointment Confirmation',
  'appointment_created',
  true,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": { "label": "Appointment Booked" }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "action_type": "send_email",
          "config": {
            "template_id": "d1000001-0001-0000-0000-000000000001"
          }
        }
      }
    ],
    "edges": [
      { "source": "trigger-1", "target": "action-1" }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;

-- Appointment Reminder (24h) Workflow
INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
VALUES (
  'd2000001-0003-0000-0000-000000000001',
  'Appointment Reminder - 24 Hours',
  'appointment_reminder',
  true,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": { "label": "24 Hours Before Appointment" }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "action_type": "send_email",
          "config": {
            "template_id": "d1000001-0002-0000-0000-000000000001"
          }
        }
      }
    ],
    "edges": [
      { "source": "trigger-1", "target": "action-1" }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;

-- Deal Stage Changed - Quote Sent Workflow
INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
VALUES (
  'd2000001-0004-0000-0000-000000000001',
  'Quote Sent to Patient',
  'deal_stage_changed',
  true,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": { 
          "label": "Deal Moved to Proposal Sent",
          "config": { "to_stage": "Proposal Sent" }
        }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "action_type": "send_email",
          "config": {
            "template_id": "d1000001-0005-0000-0000-000000000001"
          }
        }
      }
    ],
    "edges": [
      { "source": "trigger-1", "target": "action-1" }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;

-- Post-Consultation Follow-up Workflow
INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
VALUES (
  'd2000001-0005-0000-0000-000000000001',
  'Post-Consultation Follow-up',
  'consultation_completed',
  true,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": { "label": "Consultation Completed" }
      },
      {
        "id": "delay-1",
        "type": "delay",
        "data": { "config": { "delay_minutes": 120 } }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "action_type": "send_email",
          "config": {
            "template_id": "d1000001-0003-0000-0000-000000000001"
          }
        }
      }
    ],
    "edges": [
      { "source": "trigger-1", "target": "delay-1" },
      { "source": "delay-1", "target": "action-1" }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;

-- Surgery Confirmation Workflow
INSERT INTO workflows (id, name, trigger_type, active, config, is_demo)
VALUES (
  'd2000001-0006-0000-0000-000000000001',
  'Surgery Scheduled Confirmation',
  'deal_stage_changed',
  true,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": { 
          "label": "Deal Moved to Surgery Scheduled",
          "config": { "to_stage": "Surgery Scheduled" }
        }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "action_type": "send_email",
          "config": {
            "template_id": "d1000001-0006-0000-0000-000000000001"
          }
        }
      }
    ],
    "edges": [
      { "source": "trigger-1", "target": "action-1" }
    ]
  }'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Verify demo data
-- =============================================
SELECT 'email_templates' as table_name, count(*) as demo_records FROM email_templates WHERE is_demo = true
UNION ALL SELECT 'workflows', count(*) FROM workflows WHERE is_demo = true;
