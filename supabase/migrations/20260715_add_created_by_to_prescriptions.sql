-- Add created_by audit column to patient_prescriptions
-- Tracks the user who actually created the prescription record, separate from
-- mandator_id (the prescribing/selected doctor).

ALTER TABLE public.patient_prescriptions
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.patient_prescriptions.created_by IS
  'User who created the prescription record, for audit purposes.';
