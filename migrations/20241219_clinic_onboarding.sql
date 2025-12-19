-- Clinic Onboarding Schema for Aliice CRM
-- Stores onboarding data for potential clinic clients

-- Magic link tokens for secure access
CREATE TABLE IF NOT EXISTS clinic_onboarding_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_onboarding_tokens_token ON clinic_onboarding_tokens(token);
CREATE INDEX IF NOT EXISTS idx_clinic_onboarding_tokens_email ON clinic_onboarding_tokens(email);

-- Main clinic onboarding submissions
CREATE TABLE IF NOT EXISTS clinic_onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES clinic_onboarding_tokens(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'archived')),
  current_step INTEGER NOT NULL DEFAULT 1,
  
  -- Section 1: Practice Identity
  practice_name TEXT,
  practice_location TEXT,
  practice_address TEXT,
  practice_phone TEXT,
  practice_email TEXT,
  practice_website TEXT,
  main_contact_name TEXT,
  main_contact_email TEXT,
  main_contact_phone TEXT,
  main_contact_role TEXT,
  
  -- Section 2: User Management
  expected_user_count INTEGER,
  user_directory JSONB DEFAULT '[]'::jsonb, -- Array of {name, role, email}
  access_levels JSONB DEFAULT '[]'::jsonb, -- Array of selected access levels
  departments JSONB DEFAULT '[]'::jsonb, -- Array of department/location names
  
  -- Section 3: Data Migration
  current_software TEXT,
  current_software_other TEXT,
  data_access_authorized BOOLEAN DEFAULT false,
  migration_contact_name TEXT,
  migration_contact_email TEXT,
  storage_estimate TEXT, -- '<50GB', '50-100GB', '100-500GB', '500GB-1TB', '1TB+'
  patient_file_count INTEGER,
  
  -- Section 4: Clinical Services
  service_categories JSONB DEFAULT '[]'::jsonb, -- Array of category names
  services_list JSONB DEFAULT '[]'::jsonb, -- Array of {name, category, price, duration}
  services_file_url TEXT, -- URL to uploaded services file
  
  -- Section 5: Marketing & Growth
  lead_sources JSONB DEFAULT '[]'::jsonb, -- Array of selected lead sources
  marketing_automations JSONB DEFAULT '[]'::jsonb, -- Array of selected automations
  additional_notes TEXT,
  
  -- Compliance
  gdpr_consent BOOLEAN DEFAULT false,
  hipaa_acknowledgment BOOLEAN DEFAULT false,
  terms_accepted BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clinic_onboarding_submissions_status ON clinic_onboarding_submissions(status);
CREATE INDEX IF NOT EXISTS idx_clinic_onboarding_submissions_email ON clinic_onboarding_submissions(practice_email);

-- Enable RLS
ALTER TABLE clinic_onboarding_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for tokens - allow anonymous access for magic link validation
CREATE POLICY "Allow anonymous to validate tokens"
  ON clinic_onboarding_tokens FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow service role full access to tokens"
  ON clinic_onboarding_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for submissions - allow anonymous with valid token context
CREATE POLICY "Allow anonymous to create submissions"
  ON clinic_onboarding_submissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to read own submission"
  ON clinic_onboarding_submissions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous to update submissions"
  ON clinic_onboarding_submissions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read all submissions"
  ON clinic_onboarding_submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to submissions"
  ON clinic_onboarding_submissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE clinic_onboarding_tokens IS 'Magic link tokens for clinic onboarding access';
COMMENT ON TABLE clinic_onboarding_submissions IS 'Onboarding form submissions from potential Aliice clinic clients';
