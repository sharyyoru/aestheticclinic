-- =============================================================================
-- Backfill: surface the LAST marketing campaign's emails in each patient's
--           "Sent" emails tab.
-- =============================================================================
-- WHY: Campaigns sent BEFORE the email_status enum fix failed to create rows in
-- the `emails` table (the INSERT used status='sending', which the enum rejected).
-- The patient "Sent" tab reads from emails WHERE patient_id = ..., so those
-- campaign emails are invisible on the patient profile. The recipient rows
-- (marketing_campaign_recipients) DO still hold patient_id / email / sent_at,
-- and the campaign header holds the subject + html_snapshot, so we can rebuild
-- the missing `emails` rows from them.
--
-- SAFE + IDEMPOTENT:
--   * Targets only the single most-recent campaign (the "last marketing email").
--   * Only recipients that were actually sent (status in 'sent','opened').
--   * Only recipients with a patient_id (needed for the patient tab).
--   * NOT EXISTS guard prevents duplicate emails if re-run.
--   * Run the SELECT preview first to confirm the target campaign + counts.
-- =============================================================================

-- Identify the target campaign (most recent). Re-used by every step below.
-- To target a SPECIFIC campaign instead, replace the subquery with its id, e.g.
--   WHERE c.id = 'e10e0106-2b3a-431b-b965-bd644b1db92e'

-- ----------------------------------------------------------------------------
-- PREVIEW (read-only): which campaign, and how many emails would be created.
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT id, name, subject, html_snapshot, created_at
  FROM marketing_campaigns
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  t.id   AS campaign_id,
  t.name AS campaign_name,
  t.created_at,
  count(r.id) FILTER (
    WHERE r.status IN ('sent', 'opened')
      AND r.patient_id IS NOT NULL
  ) AS sent_recipients,
  count(r.id) FILTER (
    WHERE r.status IN ('sent', 'opened')
      AND r.patient_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM emails e
        WHERE e.patient_id = r.patient_id
          AND e.to_address = r.email
          AND e.subject = t.subject
          AND e.sent_at IS NOT DISTINCT FROM r.sent_at
      )
  ) AS emails_to_create
FROM target t
LEFT JOIN marketing_campaign_recipients r ON r.campaign_id = t.id
GROUP BY t.id, t.name, t.created_at, t.subject;

-- ----------------------------------------------------------------------------
-- 1. Create the missing `emails` rows for the last campaign.
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT id, subject, html_snapshot
  FROM marketing_campaigns
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO emails (
  patient_id, to_address, from_address, subject, body,
  direction, status, sent_at, read_at, created_at
)
SELECT
  r.patient_id,
  r.email,
  'info@aesthetics-ge.ch',
  t.subject,
  COALESCE(t.html_snapshot, ''),
  'outbound'::email_direction,
  (CASE WHEN r.opened_at IS NOT NULL THEN 'read' ELSE 'sent' END)::email_status,
  r.sent_at,
  r.opened_at,
  COALESCE(r.sent_at, now())
FROM marketing_campaign_recipients r
JOIN target t ON t.id = r.campaign_id
WHERE r.status IN ('sent', 'opened')
  AND r.patient_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM emails e
    WHERE e.patient_id = r.patient_id
      AND e.to_address = r.email
      AND e.subject = t.subject
      AND e.sent_at IS NOT DISTINCT FROM r.sent_at
  );

-- ----------------------------------------------------------------------------
-- 2. Link the recipient rows back to the new emails (keeps data tidy + lets
--    future open-tracking attach correctly). Only fills NULL links.
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT id, subject
  FROM marketing_campaigns
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE marketing_campaign_recipients r
SET email_id = e.id
FROM emails e, target t
WHERE r.campaign_id = t.id
  AND r.email_id IS NULL
  AND r.patient_id = e.patient_id
  AND r.email = e.to_address
  AND e.subject = t.subject
  AND e.sent_at IS NOT DISTINCT FROM r.sent_at;

-- ----------------------------------------------------------------------------
-- 3. Personalize the backfilled bodies.
--    The backfill used the campaign html_snapshot (the pre-substitution
--    template), so bodies still contain {{patient.first_name}} etc. The
--    per-recipient personalized HTML was never stored, so we re-run the same
--    substitution the app uses (see src/lib/marketingFilters.ts) directly in
--    SQL, pulling real values from the patients table.
--    Idempotent: only touches bodies that still contain {{...}} tokens.
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT id FROM marketing_campaigns ORDER BY created_at DESC LIMIT 1
),
campaign_emails AS (
  SELECT DISTINCT r.email_id
  FROM marketing_campaign_recipients r
  JOIN target t ON t.id = r.campaign_id
  WHERE r.email_id IS NOT NULL
)
UPDATE emails e
SET body =
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
    e.body,
    '\{+\s*patient\.first_name\s*\}+', COALESCE(p.first_name,''), 'g'),
    '\{+\s*patient\.last_name\s*\}+',  COALESCE(p.last_name,''),  'g'),
    '\{+\s*patient\.(full_name|name)\s*\}+', TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')), 'g'),
    '\{+\s*patient\.email\s*\}+',      COALESCE(p.email,''),      'g'),
    '\{+\s*patient\.phone\s*\}+',      COALESCE(p.phone,''),      'g'),
    '\{+\s*(first_name|firstname|firstName)\s*\}+', COALESCE(p.first_name,''), 'g'),
    '\{+\s*(last_name|lastname|lastName)\s*\}+',    COALESCE(p.last_name,''),  'g'),
    '\{+\s*(full_name|fullname|fullName|name)\s*\}+', TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')), 'g')
FROM patients p, campaign_emails ce
WHERE e.id = ce.email_id
  AND e.patient_id = p.id
  AND e.body ~ '\{+\s*[a-zA-Z0-9_.]+\s*\}+';

-- ----------------------------------------------------------------------------
-- VERIFY: confirm the emails now exist for the campaign's patients.
-- ----------------------------------------------------------------------------
-- WITH target AS (SELECT id, subject FROM marketing_campaigns ORDER BY created_at DESC LIMIT 1)
-- SELECT count(*) FROM emails e JOIN target t ON e.subject = t.subject;
