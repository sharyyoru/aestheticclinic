-- Dropped Calls Table
-- Stores calls where Retell AI couldn't understand the caller
-- These need human follow-up

CREATE TABLE IF NOT EXISTS dropped_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Call information from Retell
  retell_call_id TEXT,
  from_number TEXT NOT NULL,
  to_number TEXT,
  call_duration_seconds INTEGER,
  disconnection_reason TEXT,
  transcript TEXT,
  
  -- Patient linkage (if phone was found in system)
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Task assignment
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_method TEXT DEFAULT 'round_robin', -- 'round_robin' or 'deal_owner'
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'resolved', 'no_answer', 'invalid')),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dropped_calls_from_number ON dropped_calls(from_number);
CREATE INDEX IF NOT EXISTS idx_dropped_calls_patient_id ON dropped_calls(patient_id);
CREATE INDEX IF NOT EXISTS idx_dropped_calls_assigned_to ON dropped_calls(assigned_to);
CREATE INDEX IF NOT EXISTS idx_dropped_calls_status ON dropped_calls(status);
CREATE INDEX IF NOT EXISTS idx_dropped_calls_created_at ON dropped_calls(created_at DESC);

-- Enable RLS
ALTER TABLE dropped_calls ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all dropped calls
CREATE POLICY "Authenticated users can read dropped calls"
  ON dropped_calls FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert dropped calls
CREATE POLICY "Authenticated users can insert dropped calls"
  ON dropped_calls FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update dropped calls
CREATE POLICY "Authenticated users can update dropped calls"
  ON dropped_calls FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for service role to do anything
CREATE POLICY "Service role has full access to dropped calls"
  ON dropped_calls FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Round robin tracking table for dropped call assignments
CREATE TABLE IF NOT EXISTS dropped_call_round_robin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  last_assigned_at TIMESTAMPTZ,
  assignment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_dropped_call_round_robin_user ON dropped_call_round_robin(user_id);

-- RLS for round robin table
ALTER TABLE dropped_call_round_robin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read round robin"
  ON dropped_call_round_robin FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage round robin"
  ON dropped_call_round_robin FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to round robin"
  ON dropped_call_round_robin FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment on tables
COMMENT ON TABLE dropped_calls IS 'Stores calls where Retell AI could not understand the caller, requiring human follow-up';
COMMENT ON TABLE dropped_call_round_robin IS 'Tracks round-robin assignment for dropped call follow-ups';
