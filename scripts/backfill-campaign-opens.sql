-- =============================================================================
-- Backfill marketing campaign "opens" from already-recorded email reads
-- =============================================================================
-- WHY: The tracking pixel always recorded opens on the `emails` table
-- (emails.read_at), but the open event was never mirrored to
-- marketing_campaign_recipients.opened_at / marketing_campaigns.total_opened,
-- so campaigns sent BEFORE the code fix show 0 opens even though reads exist.
--
-- This one-time script copies those reads across. It is SAFE and idempotent:
--   * Only fills opened_at where it is currently NULL (never overwrites).
--   * Recomputes total_opened from the source of truth (exact counts).
--   * Run the SELECT preview first if you want to see the impact.
-- =============================================================================

-- Preview: how many recipients would gain an opened_at, per campaign.
SELECT r.campaign_id, count(*) AS opens_to_backfill
FROM marketing_campaign_recipients r
JOIN emails e ON e.id = r.email_id
WHERE e.read_at IS NOT NULL
  AND r.opened_at IS NULL
GROUP BY r.campaign_id
ORDER BY opens_to_backfill DESC;

-- 1. Mirror email reads onto campaign recipients.
UPDATE marketing_campaign_recipients r
SET opened_at = e.read_at,
    status = 'opened'
FROM emails e
WHERE r.email_id = e.id
  AND e.read_at IS NOT NULL
  AND r.opened_at IS NULL;

-- 2. Recompute total_opened for every campaign from the recipient rows.
UPDATE marketing_campaigns c
SET total_opened = COALESCE(sub.cnt, 0)
FROM (
  SELECT campaign_id, count(*) AS cnt
  FROM marketing_campaign_recipients
  WHERE opened_at IS NOT NULL
  GROUP BY campaign_id
) sub
WHERE c.id = sub.campaign_id;

-- Verify:
-- SELECT id, name, total_recipients, total_sent, total_opened FROM marketing_campaigns ORDER BY created_at DESC;
