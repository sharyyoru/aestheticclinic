-- AI Call scheduling from patient page
-- Adds prompt storage to scheduled calls and links them to the unified call_logs view.

ALTER TABLE retell_scheduled_calls
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_id text;

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS scheduled_call_id uuid REFERENCES retell_scheduled_calls(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt text;

CREATE INDEX IF NOT EXISTS idx_call_logs_scheduled_call_id ON call_logs(scheduled_call_id);
CREATE INDEX IF NOT EXISTS idx_retell_scheduled_calls_task_id ON retell_scheduled_calls(task_id);

-- Update RLS to allow updates on call_logs (needed by Retell webhook to enrich scheduled rows)
DROP POLICY IF EXISTS "Authenticated users can update call logs" ON call_logs;
CREATE POLICY "Authenticated users can update call logs"
  ON call_logs FOR UPDATE
  TO authenticated
  USING (true);

GRANT UPDATE ON call_logs TO authenticated;
