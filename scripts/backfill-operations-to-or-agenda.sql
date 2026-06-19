-- Backfill: Move all existing operation appointments onto the Operation Room (OR) agenda.
--
-- Operations are identified by the [Category: OP Surgery] tag in the reason field.
-- This script ensures they all have [Doctor: Operation Room] so they appear on the OR
-- calendar column. The update is idempotent — it only adds the tag if missing.
--
-- Run this in Supabase SQL Editor or via psql.

-- Add [Doctor: Operation Room] to operation appointments that don't already have it.
-- We use a regex to ensure we don't duplicate the tag if it's already present.
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
WHERE reason ~ '\[Category:\s*OP Surgery\s*\]';

-- Report how many rows were updated (run separately to see count)
-- SELECT COUNT(*) FROM appointments WHERE reason ~ '\[Category:\s*OP Surgery\s*\]';
