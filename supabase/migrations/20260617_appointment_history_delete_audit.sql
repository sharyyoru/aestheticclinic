-- Make appointment deletions traceable.
--
-- Problem: appointment_history.appointment_id was defined ON DELETE CASCADE,
-- so hard-deleting an appointment also wiped its entire change history. There
-- was also no 'deleted' change_type, so deletions left no audit trail at all.
--
-- This migration:
--   1. Allows appointment_id to be NULL and switches the FK to ON DELETE SET NULL
--      so history rows survive after the appointment row is removed.
--   2. Adds 'deleted' to the allowed change_type values.
--   3. Adds denormalized snapshot columns so a deleted appointment's record
--      remains meaningful even once appointment_id is nulled.

-- 1. Drop the cascading FK and recreate it as ON DELETE SET NULL ----------------
ALTER TABLE appointment_history
  ALTER COLUMN appointment_id DROP NOT NULL;

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'appointment_history'::regclass
    AND contype = 'f'
    AND confrelid = 'appointments'::regclass;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE appointment_history DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE appointment_history
  ADD CONSTRAINT appointment_history_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- 2. Allow the 'deleted' change type -------------------------------------------
ALTER TABLE appointment_history
  DROP CONSTRAINT IF EXISTS appointment_history_change_type_check;

ALTER TABLE appointment_history
  ADD CONSTRAINT appointment_history_change_type_check
  CHECK (change_type IN ('created', 'rescheduled', 'cancelled', 'updated', 'deleted'));

-- 3. Denormalized snapshot columns for surviving delete records ----------------
ALTER TABLE appointment_history
  ADD COLUMN IF NOT EXISTS original_reason TEXT,
  ADD COLUMN IF NOT EXISTS original_patient_id UUID;
