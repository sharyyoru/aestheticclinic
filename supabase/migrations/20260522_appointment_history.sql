-- Appointment change history table
CREATE TABLE IF NOT EXISTS appointment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'rescheduled', 'cancelled', 'updated')),
  
  -- Original values (before change)
  original_start_time TIMESTAMPTZ,
  original_end_time TIMESTAMPTZ,
  original_status TEXT,
  original_location TEXT,
  
  -- New values (after change)
  new_start_time TIMESTAMPTZ,
  new_end_time TIMESTAMPTZ,
  new_status TEXT,
  new_location TEXT,
  
  -- Additional context
  notes TEXT
);

-- Index for quick lookup by appointment
CREATE INDEX IF NOT EXISTS idx_appointment_history_appointment_id ON appointment_history(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_history_changed_at ON appointment_history(changed_at DESC);

-- Enable RLS
ALTER TABLE appointment_history ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all history
CREATE POLICY "Authenticated users can read appointment history"
  ON appointment_history FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert history
CREATE POLICY "Authenticated users can insert appointment history"
  ON appointment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON appointment_history TO authenticated;
