-- Record what actually happened to an outbound email, and flag patients whose
-- address the provider refuses.
--
-- Until now `emails.status` was written as 'sent' (with sent_at) *before* the
-- provider was called, and a provider rejection never updated the row. A
-- silently undelivered appointment confirmation was therefore indistinguishable
-- from a delivered one: an audit of the 60 most recent confirmations found 9
-- that Mailgun refused outright, every one of them still showing 'sent'.
--
-- Mailgun also answers a suppressed address with 2xx and fails it
-- asynchronously, so the failure exists only in its event log. There is no
-- column to record the reason and no way to see that a patient is cut off, so
-- staff kept booking people who could never be reached by email.

ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.emails.error IS
  'Provider failure reason. Null unless status = ''failed''.';

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS email_undeliverable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_undeliverable_reason TEXT,
  ADD COLUMN IF NOT EXISTS email_undeliverable_at TIMESTAMPTZ;

COMMENT ON COLUMN public.patients.email_undeliverable IS
  'True when the provider permanently refuses this address (hard bounce or suppression list). Appointment confirmations and reminders will NOT reach this patient — contact them by phone.';

-- Partial indexes: both flags are rare, so only the true/failed rows are indexed.
CREATE INDEX IF NOT EXISTS idx_patients_email_undeliverable
  ON public.patients(email_undeliverable)
  WHERE email_undeliverable;

CREATE INDEX IF NOT EXISTS idx_emails_failed
  ON public.emails(created_at DESC)
  WHERE status = 'failed';
