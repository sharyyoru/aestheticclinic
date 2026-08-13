-- Contact-status tracking for call_logs, mirroring dropped_calls' status enum.
-- Named "contact_status" (not "status") to avoid clashing with the existing
-- raw Retell call_status column (e.g. "ended", "registered").
--
-- Used by the new "Missed Calls" merged view (call_logs unanswered/failed
-- inbound calls + dropped_calls) so front desk can track whether the
-- customer has been called back.

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'pending'
    CHECK (contact_status IN ('pending', 'contacted', 'resolved', 'no_answer', 'invalid')),
  ADD COLUMN IF NOT EXISTS contact_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_logs_contact_status ON call_logs(contact_status);

COMMENT ON COLUMN call_logs.contact_status IS 'Front-desk follow-up status for missed/failed calls: pending, contacted, resolved, no_answer, invalid';
