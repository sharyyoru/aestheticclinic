-- Migration: Fix insurance_type check constraint
-- The existing constraint may be blocking valid values like SEMI-PRIVATE

-- Drop the existing check constraint if it exists
ALTER TABLE patient_insurances DROP CONSTRAINT IF EXISTS patient_insurances_insurance_type_check;

-- Add a more permissive check constraint that accepts the values used in the form
ALTER TABLE patient_insurances ADD CONSTRAINT patient_insurances_insurance_type_check 
  CHECK (insurance_type IS NULL OR insurance_type IN ('PRIVATE', 'SEMI-PRIVATE', 'BASIC', 'private', 'semi-private', 'basic'));
