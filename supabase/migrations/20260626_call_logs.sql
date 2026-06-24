-- Unified call log store for Retell AI calls (inbound + outbound).
--
-- Until now, call transcripts only lived as free text inside patients.notes
-- (inbound agent) and nowhere reliable for outbound calls. This table gives a
-- single, structured home for every call so the patient CRM "Call Logs" tab can
-- render a clean, readable conversation, and so we can record which follow-up
-- task was created and who it was assigned to (round-robin).

CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text UNIQUE,                       -- Retell call_id (dedup key)
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  direction text,                            -- inbound | outbound | web
  agent_id text,
  from_number text,
  to_number text,
  call_status text,
  disconnection_reason text,
  duration_seconds integer,
  summary text,                              -- human-readable call summary
  transcript text,                           -- raw transcript text (fallback)
  transcript_turns jsonb,                    -- [{ "role": "agent"|"patient", "content": "..." }]
  recording_url text,
  service_interest text,
  -- Follow-up task created for this call + who it was assigned to (round-robin)
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_user_name text,
  source text DEFAULT 'retell',
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_patient_id ON call_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read call logs" ON call_logs;
CREATE POLICY "Authenticated users can read call logs"
  ON call_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert call logs" ON call_logs;
CREATE POLICY "Authenticated users can insert call logs"
  ON call_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON call_logs TO authenticated;
