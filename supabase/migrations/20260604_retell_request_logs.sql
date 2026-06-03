-- Create table to log all Retell webhook requests
CREATE TABLE IF NOT EXISTS retell_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request identification
  call_id TEXT,
  event_type TEXT,
  function_name TEXT,
  
  -- Full request data
  request_body JSONB NOT NULL,
  
  -- Extracted data for easy querying
  args JSONB,
  metadata JSONB,
  dynamic_variables JSONB,
  call_data JSONB,
  
  -- Response data
  response_body JSONB,
  response_status INTEGER,
  
  -- Processing info
  processing_time_ms INTEGER,
  error_message TEXT,
  
  -- Patient correlation
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_retell_logs_created_at ON retell_request_logs(created_at DESC);
CREATE INDEX idx_retell_logs_call_id ON retell_request_logs(call_id);
CREATE INDEX idx_retell_logs_function ON retell_request_logs(function_name);
CREATE INDEX idx_retell_logs_event ON retell_request_logs(event_type);
CREATE INDEX idx_retell_logs_patient ON retell_request_logs(patient_id);

-- Enable RLS
ALTER TABLE retell_request_logs ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view logs
CREATE POLICY "Authenticated users can view retell logs" 
  ON retell_request_logs FOR SELECT 
  TO authenticated 
  USING (true);

-- Policy for service role to insert
CREATE POLICY "Service role can insert retell logs"
  ON retell_request_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
