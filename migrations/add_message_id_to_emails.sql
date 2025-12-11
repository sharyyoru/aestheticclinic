-- Add message_id column to emails table for tracking email threads via Mailgun Message-ID
-- This allows us to match email replies to original messages using standard email headers

ALTER TABLE emails
ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Create index for faster lookups when matching replies via In-Reply-To header
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

-- Add comment to explain the column
COMMENT ON COLUMN emails.message_id IS 'Mailgun Message-ID for tracking email threads and matching replies via In-Reply-To and References headers';
