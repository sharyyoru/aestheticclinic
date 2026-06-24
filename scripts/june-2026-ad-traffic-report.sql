-- ============================================================================
-- June 2026 ad-traffic / conversion report
-- ============================================================================
-- Source of truth: public.embed_form_leads (the ONLY table that stores
-- per-lead attribution: utm_*, referrer, source_url). Booking + contact embeds
-- write here. NOTE: main-site /book-appointment and /intake forms do NOT store
-- UTM and are therefore invisible to these attribution queries.
--
-- Spend ($) is NOT in the database. Get it from Google Ads / Meta Ads and
-- divide by the "converted" counts below to compute cost-per-lead.
--
-- All ranges use Europe/Zurich (Swiss) calendar month for June 2026.
-- ============================================================================

-- Reusable June window (Swiss time): [2026-06-01, 2026-07-01)
-- created_at is timestamptz, so we compare against tz-aware bounds.

-- ----------------------------------------------------------------------------
-- 1) Headline: total leads + conversions for June, by form type
-- ----------------------------------------------------------------------------
SELECT
  form_type,
  COUNT(*)                                                   AS total_leads,
  COUNT(*) FILTER (WHERE converted_to_patient_id IS NOT NULL) AS converted_to_patient,
  COUNT(*) FILTER (WHERE is_existing_patient)                AS existing_patients,
  COUNT(DISTINCT email)                                      AS unique_emails
FROM embed_form_leads
WHERE created_at >= TIMESTAMPTZ '2026-06-01 00:00:00+02'
  AND created_at <  TIMESTAMPTZ '2026-07-01 00:00:00+02'
GROUP BY ROLLUP (form_type)
ORDER BY total_leads DESC;

-- ----------------------------------------------------------------------------
-- 2) WHERE TRAFFIC COMES FROM — by UTM source / medium / campaign
--    (Untagged traffic shows up as '(none)'.)
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(NULLIF(utm_source, ''),   '(none)') AS utm_source,
  COALESCE(NULLIF(utm_medium, ''),   '(none)') AS utm_medium,
  COALESCE(NULLIF(utm_campaign, ''), '(none)') AS utm_campaign,
  COUNT(*)                                                    AS leads,
  COUNT(*) FILTER (WHERE converted_to_patient_id IS NOT NULL) AS converted
FROM embed_form_leads
WHERE created_at >= TIMESTAMPTZ '2026-06-01 00:00:00+02'
  AND created_at <  TIMESTAMPTZ '2026-07-01 00:00:00+02'
GROUP BY 1, 2, 3
ORDER BY leads DESC;

-- ----------------------------------------------------------------------------
-- 3) Fallback attribution for untagged leads — by HTTP referrer + embed page
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(NULLIF(referrer, ''),   '(direct/none)') AS referrer,
  COALESCE(NULLIF(source_url, ''), '(unknown)')     AS embed_page,
  COUNT(*) AS leads
FROM embed_form_leads
WHERE created_at >= TIMESTAMPTZ '2026-06-01 00:00:00+02'
  AND created_at <  TIMESTAMPTZ '2026-07-01 00:00:00+02'
  AND (utm_source IS NULL OR utm_source = '')
GROUP BY 1, 2
ORDER BY leads DESC;

-- ----------------------------------------------------------------------------
-- 4) Daily volume (spot bot spikes / campaign bursts)
-- ----------------------------------------------------------------------------
SELECT
  (created_at AT TIME ZONE 'Europe/Zurich')::date AS day,
  COUNT(*)                                        AS leads,
  COUNT(DISTINCT email)                           AS unique_emails,
  COUNT(DISTINCT ip_address)                      AS unique_ips
FROM embed_form_leads
WHERE created_at >= TIMESTAMPTZ '2026-06-01 00:00:00+02'
  AND created_at <  TIMESTAMPTZ '2026-07-01 00:00:00+02'
GROUP BY 1
ORDER BY 1;

-- ----------------------------------------------------------------------------
-- 5) Possible junk/bot signal — same IP submitting many leads in June
-- ----------------------------------------------------------------------------
SELECT
  ip_address,
  COUNT(*)              AS submissions,
  COUNT(DISTINCT email) AS distinct_emails
FROM embed_form_leads
WHERE created_at >= TIMESTAMPTZ '2026-06-01 00:00:00+02'
  AND created_at <  TIMESTAMPTZ '2026-07-01 00:00:00+02'
  AND ip_address IS NOT NULL AND ip_address <> 'unknown'
GROUP BY ip_address
HAVING COUNT(*) > 2
ORDER BY submissions DESC;

-- ----------------------------------------------------------------------------
-- 6) Cost-per-lead helper — fill in spend from Google/Meta, then run.
--    Replace the VALUES with each campaign's June spend (CHF).
-- ----------------------------------------------------------------------------
WITH spend(utm_campaign, spend_chf) AS (
  VALUES
    -- ('your_campaign_name', 1234.56),
    ('REPLACE_ME', 0.00)
),
leads AS (
  SELECT
    COALESCE(NULLIF(utm_campaign, ''), '(none)') AS utm_campaign,
    COUNT(*)                                                    AS leads,
    COUNT(*) FILTER (WHERE converted_to_patient_id IS NOT NULL) AS converted
  FROM embed_form_leads
  WHERE created_at >= TIMESTAMPTZ '2026-06-01 00:00:00+02'
    AND created_at <  TIMESTAMPTZ '2026-07-01 00:00:00+02'
  GROUP BY 1
)
SELECT
  l.utm_campaign,
  l.leads,
  l.converted,
  s.spend_chf,
  ROUND(s.spend_chf / NULLIF(l.leads, 0), 2)     AS cost_per_lead,
  ROUND(s.spend_chf / NULLIF(l.converted, 0), 2) AS cost_per_converted
FROM leads l
LEFT JOIN spend s USING (utm_campaign)
ORDER BY l.leads DESC;
