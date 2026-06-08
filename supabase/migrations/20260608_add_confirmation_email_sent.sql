-- Add confirmation_email_sent flag to appointments to prevent duplicate emails
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS confirmation_email_sent boolean DEFAULT false;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_email_sent 
ON appointments(id) WHERE confirmation_email_sent = false;

-- Comment
COMMENT ON COLUMN appointments.confirmation_email_sent IS 'Flag to prevent duplicate confirmation emails from being sent';
