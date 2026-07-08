-- Migration: Add CC address column to emails table for insurance/third-party copies
-- This allows storing CC recipients when sending patient emails to insurance companies

ALTER TABLE emails ADD COLUMN IF NOT EXISTS cc_address text;

COMMENT ON COLUMN emails.cc_address IS 'Optional CC email address (e.g., insurance company, third party)';
