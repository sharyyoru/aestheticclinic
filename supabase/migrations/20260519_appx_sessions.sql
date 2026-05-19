-- Migration: Create appx_sessions table for AI assistant session tracking
-- Date: 2026-05-19

CREATE TABLE IF NOT EXISTS appx_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  commands JSONB DEFAULT '[]'::jsonb,
  changes JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appx_sessions_user_id ON appx_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_appx_sessions_patient_id ON appx_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_appx_sessions_status ON appx_sessions(status);
CREATE INDEX IF NOT EXISTS idx_appx_sessions_started_at ON appx_sessions(started_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_appx_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_appx_sessions_updated_at ON appx_sessions;
CREATE TRIGGER trigger_appx_sessions_updated_at
  BEFORE UPDATE ON appx_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_appx_sessions_updated_at();

-- RLS
ALTER TABLE appx_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON appx_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
