-- Backfill: Move all appointments whose deal is in "Operation Scheduled" stage onto the Operation Room (OR) agenda.
--
-- This script joins appointments -> deals -> deal_stages to find appointments associated with deals
-- in the "Operation Scheduled" stage, then adds [Doctor: Operation Room] to their reason field
-- so they appear on the OR calendar column. The update is idempotent — it only adds the tag if missing.
--
-- Run this in Supabase SQL Editor or via psql.

-- Add [Doctor: Operation Room] to appointments whose deal is in "Operation Scheduled" stage
-- and that don't already have the OR doctor tag.
UPDATE appointments
SET reason =
  CASE
    -- If [Doctor: Operation Room] is already present, leave reason unchanged
    WHEN reason ~ '\[Doctor:\s*Operation Room\s*\]' THEN reason
    -- Otherwise, append the tag (preserve existing [Doctor: ...] if present by replacing it)
    WHEN reason ~ '\[Doctor:' THEN
      regexp_replace(reason, '\[Doctor:[^\]]*\]', '[Doctor: Operation Room]', 'g')
    -- No [Doctor: tag at all — append it
    ELSE reason || ' [Doctor: Operation Room]'
  END
WHERE deal_id IN (
  SELECT d.id
  FROM deals d
  JOIN deal_stages ds ON d.stage_id = ds.id
  WHERE LOWER(ds.name) LIKE '%operation scheduled%'
)
AND reason !~ '\[Doctor:\s*Operation Room\s*\]';

-- Report how many rows were updated (run separately to see count)
-- SELECT COUNT(*) FROM appointments
-- WHERE deal_id IN (
--   SELECT d.id FROM deals d JOIN deal_stages ds ON d.stage_id = ds.id
--   WHERE LOWER(ds.name) LIKE '%operation scheduled%'
-- )
-- AND reason !~ '\[Doctor:\s*Operation Room\s*\]';
