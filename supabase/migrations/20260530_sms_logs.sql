-- SMS Logs Table
-- Stores all SMS messages sent through the system (Retell AI, workflows, manual)

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  to_number TEXT NOT NULL,
  from_number TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'general', -- booking_link, contact_info, reminder, general
  source TEXT DEFAULT 'manual', -- retell_ai, workflow, manual, system
  twilio_sid TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, failed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_patient_id ON sms_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_to_number ON sms_logs(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_source ON sms_logs(source);

-- Enable RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all SMS logs
CREATE POLICY "Authenticated users can read SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert SMS logs
CREATE POLICY "Authenticated users can insert SMS logs"
  ON sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for service role to do anything
CREATE POLICY "Service role has full access to SMS logs"
  ON sms_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE sms_logs IS 'Stores all SMS messages sent to patients via Twilio';
