-- Article Distribution Tracking
-- Tracks press releases and content syndication for backlink building

CREATE TABLE IF NOT EXISTS article_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT NOT NULL,
    service TEXT NOT NULL DEFAULT 'prnow',
    external_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    title TEXT NOT NULL,
    placements_count INTEGER DEFAULT 0,
    report_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    cost DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_distributions_article_id ON article_distributions(article_id);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON article_distributions(status);
CREATE INDEX IF NOT EXISTS idx_distributions_service ON article_distributions(service);
CREATE INDEX IF NOT EXISTS idx_distributions_submitted_at ON article_distributions(submitted_at DESC);

-- Track backlinks generated from distributions
CREATE TABLE IF NOT EXISTS distribution_backlinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID NOT NULL REFERENCES article_distributions(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    source_domain TEXT NOT NULL,
    anchor_text TEXT,
    target_url TEXT NOT NULL,
    domain_authority INTEGER,
    is_dofollow BOOLEAN DEFAULT true,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    is_live BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_backlinks_distribution ON distribution_backlinks(distribution_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_domain ON distribution_backlinks(source_domain);
CREATE INDEX IF NOT EXISTS idx_backlinks_is_live ON distribution_backlinks(is_live);

-- Update trigger for article_distributions
CREATE OR REPLACE FUNCTION update_distribution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_distribution_timestamp ON article_distributions;
CREATE TRIGGER trigger_update_distribution_timestamp
    BEFORE UPDATE ON article_distributions
    FOR EACH ROW
    EXECUTE FUNCTION update_distribution_timestamp();

-- View for distribution stats
CREATE OR REPLACE VIEW distribution_stats AS
SELECT 
    COUNT(*) as total_distributions,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'submitted') as pending,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    SUM(placements_count) as total_placements,
    SUM(cost) as total_cost,
    (SELECT COUNT(*) FROM distribution_backlinks WHERE is_live = true) as active_backlinks
FROM article_distributions;

-- RLS policies
ALTER TABLE article_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_backlinks ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role
CREATE POLICY "Service role full access to distributions"
    ON article_distributions FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access to backlinks"
    ON distribution_backlinks FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE article_distributions IS 'Tracks articles submitted for press release distribution';
COMMENT ON TABLE distribution_backlinks IS 'Tracks backlinks generated from distributed articles';
