-- Defensive migration: sent_by_user_id is referenced throughout the codebase
-- (email send routes, inbound mailgun webhook, scheduled reminders, and the
-- last-contact / user-activity reporting features) but was never captured in
-- a tracked migration. Idempotent so it's safe to run even if the column
-- already exists (e.g. added manually via the Supabase dashboard).

ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emails_sent_by_user_id ON emails(sent_by_user_id);

COMMENT ON COLUMN emails.sent_by_user_id IS 'Staff member who sent this email (outbound) — used for last-contact and user-activity reporting.';
