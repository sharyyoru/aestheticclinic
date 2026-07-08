-- Migration: Add email column to patient_insurances table
-- This allows storing the insurance company email address for direct correspondence

ALTER TABLE patient_insurances ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN patient_insurances.email IS 'Insurance company email address for claim correspondence and document sharing';
