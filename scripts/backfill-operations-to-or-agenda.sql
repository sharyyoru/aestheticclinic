-- Backfill: Move all appointments whose deal is in "Operation Scheduled" stage onto the Operation Room (OR) agenda.
--
-- Appointments are linked to deals via patient_id (not a direct deal_id column).
-- This script finds patients whose deals are in "Operation Scheduled" stage,
-- then updates their appointments to include [Doctor: Operation Room] so they
-- appear on the OR calendar column. The update is idempotent — it only adds the tag if missing.
--
-- Run this in Supabase SQL Editor or via psql.

-- Add [Doctor: Operation Room] to appointments for patients whose deal is in "Operation Scheduled" stage
-- and that don't already have the OR doctor tag.
UPDATE appointments
SET reason =
  CASE
    -- If [Doctor: Operation Room] is already present, leave reason unchanged
    WHEN reason ILIKE '%[Doctor: Operation Room]%' THEN reason
    -- Otherwise, append the tag (preserve existing [Doctor: ...] if present by replacing it)
    WHEN reason ILIKE '%[Doctor:%' THEN
      regexp_replace(reason, '\[Doctor:[^\]]*\]', '[Doctor: Operation Room]', 'g')
    -- No [Doctor: tag at all — append it
    ELSE reason || ' [Doctor: Operation Room]'
  END
WHERE patient_id IN (
  SELECT d.patient_id
  FROM deals d
  JOIN deal_stages ds ON d.stage_id = ds.id
  WHERE ds.name ILIKE '%operation scheduled%'
)
AND reason NOT ILIKE '%[Doctor: Operation Room]%';

-- Report how many rows were updated (run separately to see count)
-- SELECT COUNT(*) FROM appointments
-- WHERE patient_id IN (
--   SELECT d.patient_id FROM deals d JOIN deal_stages ds ON d.stage_id = ds.id
--   WHERE ds.name ILIKE '%operation scheduled%'
-- )
-- AND reason NOT ILIKE '%[Doctor: Operation Room]%';
