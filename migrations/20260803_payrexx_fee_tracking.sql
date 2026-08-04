-- Migration: Track Payrexx transaction fees separately from invoice amounts
-- Date: 2026-08-03
--
-- Payrexx charges the patient the FULL invoice amount, but deducts its own
-- processing fee (transaction.payrexxFee) before paying out to the clinic's
-- bank account. Previously we had no way to record this fee, so invoices
-- looked "fully paid" even though the clinic actually receives less.
--
-- These columns let us record the net amount the clinic actually receives
-- and the fee that was deducted, so accounting reflects reality.

ALTER TABLE IF EXISTS invoices
  ADD COLUMN IF NOT EXISTS payrexx_fee_amount NUMERIC(12,2);

ALTER TABLE IF EXISTS invoice_payments
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);

COMMENT ON COLUMN invoices.payrexx_fee_amount IS
  'Payrexx processing fee (CHF) deducted from the gross amount charged to the patient. When > 0, invoice.paid_amount reflects the NET amount received (gross - fee) and status is set to PARTIAL_LOSS.';

COMMENT ON COLUMN invoice_payments.fee_amount IS
  'Payment-processor fee (CHF) deducted from this specific payment, if any (e.g. Payrexx transaction fee).';
