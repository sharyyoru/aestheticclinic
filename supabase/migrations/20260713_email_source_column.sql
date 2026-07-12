-- Add source column to track where each email originated from
ALTER TABLE emails ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Backfill existing rows: emails with deal_id are from automation workflows
UPDATE emails SET source = 'automation' WHERE deal_id IS NOT NULL AND source = 'manual';

-- Index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_emails_source ON emails(source);

-- Index for faster ordering by created_at (helps prevent statement timeout)
CREATE INDEX IF NOT EXISTS idx_emails_created_at_desc ON emails(created_at DESC);

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_emails_direction_status ON emails(direction, status);
