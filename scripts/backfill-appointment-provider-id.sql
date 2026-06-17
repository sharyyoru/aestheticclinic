-- =============================================================================
-- Backfill appointments.provider_id from the [Doctor: <name>] reason tag
-- =============================================================================
-- Goal: make doctor calendars (Operation Room, Xavier Tenorio, etc.) render by
-- a real provider_id instead of depending solely on the "[Doctor: ...]" text
-- tag inside `reason`. Historically appointments were created with
-- provider_id = NULL, so the calendar matches them only by parsing the tag —
-- if that tag is ever edited, the appointment silently disappears from the view.
--
-- SAFETY MODEL (read before running):
--   * NOTHING here deletes data. It only sets provider_id where it is NULL.
--   * Run SECTION A first (read-only). It tells you the FK target and whether
--     the doctor names map cleanly to ids.
--   * SECTION B is wrapped in a transaction with a manual COMMIT, so you can
--     review the affected row count and ROLLBACK if anything looks wrong.
--   * The UPDATE only assigns ids for UNAMBIGUOUS name matches and never
--     overwrites an existing provider_id (idempotent / re-runnable).
--   * If the FK actually targets a table that lacks these ids, the UPDATE will
--     raise a foreign-key error and the transaction aborts with NO changes.
-- =============================================================================


-- =============================================================================
-- SECTION A — DIAGNOSTICS (read-only). Run these first and review the output.
-- =============================================================================

-- A1. What does appointments.provider_id reference, and what is its ON DELETE rule?
--     - NO ROWS  => provider_id has no FK; the backfill cannot violate one.
--     - referenced_table = 'users'     => Section B (which targets users) is correct.
--     - referenced_table = 'providers' => STOP. Tell me; the backfill must target
--       `providers` instead, and we must confirm the doctors exist there.
SELECT con.conname,
       cl.relname AS referenced_table,
       con.confdeltype AS on_delete  -- 'n'=SET NULL, 'c'=CASCADE, 'a'=NO ACTION, 'r'=RESTRICT
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.confrelid
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
WHERE con.conrelid = 'appointments'::regclass
  AND con.contype = 'f'
  AND a.attname = 'provider_id';

-- A2. How many NULL-provider appointments carry a [Doctor: ...] tag, grouped by tag?
SELECT btrim(substring(reason FROM '\[Doctor:\s*([^\]]+)\]')) AS doctor_tag,
       count(*) AS appt_count
FROM appointments
WHERE provider_id IS NULL
  AND reason ~ '\[Doctor:\s*[^\]]+\]'
GROUP BY 1
ORDER BY 2 DESC;

-- A3. Map each tag to users by name. This is the SAFETY PREVIEW:
--     matching_users = 0 -> no user; those rows are skipped (safe).
--     matching_users = 1 -> unambiguous; these WILL be backfilled.
--     matching_users > 1 -> ambiguous; skipped on purpose (safe).
WITH tags AS (
  SELECT DISTINCT btrim(substring(reason FROM '\[Doctor:\s*([^\]]+)\]')) AS doctor_tag
  FROM appointments
  WHERE provider_id IS NULL
    AND reason ~ '\[Doctor:\s*[^\]]+\]'
)
SELECT t.doctor_tag,
       count(u.id) AS matching_users,
       min(u.id)   AS sample_user_id
FROM tags t
LEFT JOIN users u
  ON lower(btrim(u.full_name)) = lower(t.doctor_tag)
GROUP BY t.doctor_tag
ORDER BY matching_users, t.doctor_tag;


-- =============================================================================
-- SECTION B — BACKFILL (run ONLY after A1 shows referenced_table = 'users'
--             or NO ROWS). Review the row count, then COMMIT or ROLLBACK.
-- =============================================================================
BEGIN;

WITH unique_names AS (
  -- Only names that map to exactly one user are considered (no ambiguity).
  SELECT lower(btrim(u.full_name)) AS name_key,
         max(u.id)                 AS user_id
  FROM users u
  WHERE u.full_name IS NOT NULL
    AND btrim(u.full_name) <> ''
  GROUP BY lower(btrim(u.full_name))
  HAVING count(*) = 1
)
UPDATE appointments a
SET provider_id = un.user_id
FROM unique_names un
WHERE a.provider_id IS NULL
  AND a.reason ~ '\[Doctor:\s*[^\]]+\]'
  AND lower(btrim(substring(a.reason FROM '\[Doctor:\s*([^\]]+)\]'))) = un.name_key;

-- Sanity check: how many appointments are still unlinked, grouped by tag?
-- (Run this before committing to confirm the result looks right.)
SELECT btrim(substring(reason FROM '\[Doctor:\s*([^\]]+)\]')) AS doctor_tag,
       count(*) AS still_null
FROM appointments
WHERE provider_id IS NULL
  AND reason ~ '\[Doctor:\s*[^\]]+\]'
GROUP BY 1
ORDER BY 2 DESC;

-- If the UPDATE count and the remaining-null breakdown look correct:
--   COMMIT;
-- Otherwise, to make NO changes at all:
--   ROLLBACK;
-- =============================================================================
