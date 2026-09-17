-- Capture-only enum widening. Run as its own statement batch:
-- ALTER TYPE ... ADD VALUE cannot be used by a statement in the same transaction.

-- Needed by seed_demo_data()
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'patient_created';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'appointment_reminder';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'consultation_completed';

-- Offered by the workflows UI but missing from the production enum
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'appointment_completed';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'form_submitted';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'task_completed';
