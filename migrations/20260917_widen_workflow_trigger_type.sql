-- Widen workflow_trigger_type to cover the triggers the UI already offers.
--
-- Problem: `workflows.trigger_type` is the enum `public.workflow_trigger_type`,
-- which currently accepts only:
--     deal_stage_changed | appointment_created | appointment_updated | manual
--
-- But src/app/workflows/page.tsx offers seven triggers, and
-- src/app/workflows/builder lets users build them:
--     deal_stage_changed, patient_created, appointment_created,
--     appointment_completed, form_submitted, task_completed, manual
--
-- Saving a workflow with patient_created, appointment_completed, form_submitted
-- or task_completed therefore fails with:
--     22P02: invalid input value for enum workflow_trigger_type
--
-- seed_demo_data() hits the same wall — it writes patient_created,
-- appointment_reminder and consultation_completed.
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot be used by a statement inside the
-- same transaction that added it. Run this migration on its own, before any
-- code or seed that writes the new values.

ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'patient_created';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'appointment_completed';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'form_submitted';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'task_completed';

-- Written by seed_demo_data(); include them so the demo seed runs anywhere.
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'appointment_reminder';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'consultation_completed';
