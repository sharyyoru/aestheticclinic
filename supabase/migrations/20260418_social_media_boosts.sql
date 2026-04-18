-- Migration: Create social media posts and boost tracking tables
-- Date: 2026-04-18
-- Purpose: Track social media posts and their ad spend/boost data for reimbursement reporting

-- Create social_media_accounts table
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Main Account", "Aesthetics GE"
  platform TEXT NOT NULL, -- e.g., "instagram", "tiktok", "facebook"
  handle TEXT, -- e.g., "@aesthetics_ge"
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create social_media_posts table
CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES social_media_accounts(id) ON DELETE SET NULL,
  
  -- Post details
  subject TEXT NOT NULL, -- Subject/title of the post
  content TEXT, -- Post content/caption
  post_date DATE NOT NULL,
  platform TEXT NOT NULL, -- "instagram", "tiktok", "facebook"
  post_url TEXT, -- Link to the post
  post_id_external TEXT, -- External ID from the platform
  
  -- Boost/Ad spend tracking
  is_boosted BOOLEAN DEFAULT FALSE, -- Only boosted posts appear on reports
  boost_amount_chf DECIMAL(10,2), -- Amount in CHF (NOT AED)
  boost_start_date DATE,
  boost_end_date DATE,
  boost_status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  
  -- Additional metadata
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_social_posts_account_id ON social_media_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_post_date ON social_media_posts(post_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_is_boosted ON social_media_posts(is_boosted) WHERE is_boosted = TRUE;
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_boost_status ON social_media_posts(boost_status);

-- Create index for report queries (boosted posts only)
CREATE INDEX IF NOT EXISTS idx_social_posts_report ON social_media_posts(post_date, account_id, platform) 
  WHERE is_boosted = TRUE;

-- Enable RLS
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;

-- Policies for social_media_accounts
CREATE POLICY "Allow authenticated users to view social accounts"
  ON social_media_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage social accounts"
  ON social_media_accounts
  FOR ALL
  TO authenticated
  USING (true);

-- Policies for social_media_posts
CREATE POLICY "Allow authenticated users to view social posts"
  ON social_media_posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage social posts"
  ON social_media_posts
  FOR ALL
  TO authenticated
  USING (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_media_accounts;
CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_posts_updated_at ON social_media_posts;
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample accounts (optional - for testing)
INSERT INTO social_media_accounts (name, platform, handle) VALUES
  ('Main Instagram', 'instagram', '@aesthetics_ge'),
  ('Main TikTok', 'tiktok', '@aesthetics_ge'),
  ('Facebook Page', 'facebook', '@AestheticsGE')
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE social_media_accounts IS 'Stores social media account information for tracking posts';
COMMENT ON TABLE social_media_posts IS 'Tracks social media posts with boost/ad spend data. Only boosted posts appear on reimbursement reports.';
COMMENT ON COLUMN social_media_posts.is_boosted IS 'Only TRUE posts appear on boost reports';
COMMENT ON COLUMN social_media_posts.boost_amount_chf IS 'Ad spend/boost amount in CHF (Swiss Francs) - NOT AED';
