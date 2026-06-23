-- Migration: add ad click identifiers + extra attribution to embed_form_leads
-- Date: 2026-06-23
--
-- Enables true ad-click attribution (Google/Meta/Microsoft/TikTok) and offline
-- conversion import. gclid/gbraid/wbraid are Google Ads click ids, fbclid is
-- Meta, msclkid is Microsoft Ads, ttclid is TikTok.

ALTER TABLE embed_form_leads
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS gbraid TEXT,
  ADD COLUMN IF NOT EXISTS wbraid TEXT,
  ADD COLUMN IF NOT EXISTS fbclid TEXT,
  ADD COLUMN IF NOT EXISTS msclkid TEXT,
  ADD COLUMN IF NOT EXISTS ttclid TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT;

-- Index for filtering paid (gclid-bearing) leads in the reports dashboard.
CREATE INDEX IF NOT EXISTS idx_embed_form_leads_gclid
  ON embed_form_leads(gclid)
  WHERE gclid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embed_form_leads_utm_campaign
  ON embed_form_leads(utm_campaign);

COMMENT ON COLUMN embed_form_leads.gclid IS 'Google Ads click id (for offline conversion import)';
COMMENT ON COLUMN embed_form_leads.fbclid IS 'Meta/Facebook click id';
COMMENT ON COLUMN embed_form_leads.msclkid IS 'Microsoft/Bing Ads click id';
COMMENT ON COLUMN embed_form_leads.ttclid IS 'TikTok click id';
COMMENT ON COLUMN embed_form_leads.landing_page IS 'First landing page path captured for the lead';
