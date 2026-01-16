-- Migration: Add Payrexx payment integration fields to consultations table
-- Date: 2025-01-17

-- Add Payrexx-specific columns to consultations table for online payment tracking
ALTER TABLE IF EXISTS consultations
  ADD COLUMN IF NOT EXISTS payrexx_gateway_id INTEGER,
  ADD COLUMN IF NOT EXISTS payrexx_gateway_hash TEXT,
  ADD COLUMN IF NOT EXISTS payrexx_payment_link TEXT,
  ADD COLUMN IF NOT EXISTS payrexx_transaction_id INTEGER,
  ADD COLUMN IF NOT EXISTS payrexx_transaction_uuid TEXT,
  ADD COLUMN IF NOT EXISTS payrexx_payment_status TEXT CHECK (payrexx_payment_status IN (
    'waiting',
    'confirmed',
    'authorized',
    'reserved',
    'refunded',
    'partially-refunded',
    'cancelled',
    'declined',
    'error',
    'uncaptured'
  )),
  ADD COLUMN IF NOT EXISTS payrexx_paid_at TIMESTAMPTZ;

-- Create index for faster lookups by gateway hash (used in webhooks)
CREATE INDEX IF NOT EXISTS consultations_payrexx_gateway_hash_idx 
  ON consultations(payrexx_gateway_hash) 
  WHERE payrexx_gateway_hash IS NOT NULL;

-- Create index for transaction lookups
CREATE INDEX IF NOT EXISTS consultations_payrexx_transaction_uuid_idx 
  ON consultations(payrexx_transaction_uuid) 
  WHERE payrexx_transaction_uuid IS NOT NULL;

COMMENT ON COLUMN consultations.payrexx_gateway_id IS 'Payrexx Gateway ID for online payment';
COMMENT ON COLUMN consultations.payrexx_gateway_hash IS 'Payrexx Gateway hash used in payment link';
COMMENT ON COLUMN consultations.payrexx_payment_link IS 'Full Payrexx payment URL for the invoice';
COMMENT ON COLUMN consultations.payrexx_transaction_id IS 'Payrexx transaction ID after payment attempt';
COMMENT ON COLUMN consultations.payrexx_transaction_uuid IS 'Payrexx transaction UUID for tracking';
COMMENT ON COLUMN consultations.payrexx_payment_status IS 'Current Payrexx payment status';
COMMENT ON COLUMN consultations.payrexx_paid_at IS 'Timestamp when payment was confirmed via Payrexx';
