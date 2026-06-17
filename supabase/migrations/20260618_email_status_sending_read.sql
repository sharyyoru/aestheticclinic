-- Email open-tracking fix
--
-- The application code (marketing campaign send + open-tracking pixel) and the
-- patient "Sent" emails UI rely on two email_status values that were never part
-- of the original enum:
--   * 'sending' - set when a campaign email row is first created (before Mailgun
--                  confirms the send). Without it, the INSERT into `emails` is
--                  rejected, so campaign emails never appear in the patient's
--                  Sent tab and no tracking pixel id exists.
--   * 'read'    - set by /api/emails/track when the 1x1 pixel is loaded. Without
--                  it the UPDATE is rejected and opens are never recorded.
--
-- We also ensure the emails.read_at column exists, since the tracking endpoint
-- and the patient email list both read/write it.
--
-- ALTER TYPE ... ADD VALUE is idempotent via IF NOT EXISTS (Postgres 12+),
-- non-destructive, and safe to run multiple times.

-- NOTE: ADD VALUE cannot run inside the same transaction that later uses the
-- value, but adding the values alone is fine. Run this file as-is.

ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'sending';
ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'read';

ALTER TABLE emails ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS emails_read_at_idx ON emails(read_at);
