-- Make doctor & service edits auditable.
--
-- Charline needs to change the Doctor and Service on an existing appointment,
-- and the clinic wants a record of WHO changed WHAT. The appointment_history
-- table already captures changed_by_user_id / changed_by_email plus old/new
-- start_time, end_time, status, location and original_reason. This migration
-- adds the missing before/after columns for the doctor, the service and the
-- full reason string so a doctor/service change is fully traceable.

ALTER TABLE appointment_history
  ADD COLUMN IF NOT EXISTS original_doctor TEXT,
  ADD COLUMN IF NOT EXISTS new_doctor TEXT,
  ADD COLUMN IF NOT EXISTS original_service TEXT,
  ADD COLUMN IF NOT EXISTS new_service TEXT,
  ADD COLUMN IF NOT EXISTS new_reason TEXT;
