-- Add emergency contact fields to patients table
ALTER TABLE patients 
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

COMMENT ON COLUMN patients.emergency_contact_name IS 'Emergency contact full name';
COMMENT ON COLUMN patients.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN patients.emergency_contact_relation IS 'Relationship to patient (e.g., spouse, parent, sibling)';
