-- Migration: Create lead_imports table for tracking CSV import history
-- Date: 2026-01-17

-- Create lead_imports table
CREATE TABLE IF NOT EXISTS lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  service TEXT NOT NULL,
  total_leads INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  imported_patient_ids UUID[] DEFAULT ARRAY[]::UUID[],
  errors TEXT[] DEFAULT NULL,
  import_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on import_date for faster sorting
CREATE INDEX IF NOT EXISTS idx_lead_imports_import_date ON lead_imports(import_date DESC);

-- Create index on service for filtering
CREATE INDEX IF NOT EXISTS idx_lead_imports_service ON lead_imports(service);

-- Create index on imported_patient_ids for quick patient lookups
CREATE INDEX IF NOT EXISTS idx_lead_imports_patient_ids ON lead_imports USING GIN(imported_patient_ids);

-- Enable RLS
ALTER TABLE lead_imports ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all imports
CREATE POLICY "Allow authenticated users to view imports"
  ON lead_imports
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert imports
CREATE POLICY "Allow authenticated users to insert imports"
  ON lead_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE lead_imports IS 'Tracks CSV lead import history with metadata and results';
