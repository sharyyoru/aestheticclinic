-- Migration: Merge duplicate deals with same patient and service
-- Created: 2026-05-06
-- Description: Consolidates duplicate deals that belong to the same patient and have the same service

BEGIN;

-- Create temporary table to identify duplicates and their groups
CREATE TEMP TABLE deal_duplicates AS
WITH ranked_deals AS (
  SELECT 
    d.id as deal_id,
    d.patient_id,
    d.service_id,
    d.created_at,
    p.first_name,
    p.last_name,
    p.email,
    -- Rank deals within each patient+service group, oldest first
    ROW_NUMBER() OVER (
      PARTITION BY d.patient_id, d.service_id 
      ORDER BY d.created_at ASC, d.id ASC
    ) as rn
  FROM deals d
  INNER JOIN patients p ON d.patient_id = p.id
  WHERE d.service_id IS NOT NULL -- Only process deals with services
)
SELECT 
  deal_id,
  patient_id,
  service_id,
  created_at,
  first_name,
  last_name,
  email,
  rn,
  -- The first record (rn=1) in each group is the one we'll keep
  FIRST_VALUE(deal_id) OVER (
    PARTITION BY patient_id, service_id 
    ORDER BY created_at ASC, deal_id ASC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) as keeper_deal_id
FROM ranked_deals;

-- Log what we're about to do
DO $$
DECLARE
  duplicate_count INTEGER;
  keeper_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count 
  FROM deal_duplicates 
  WHERE rn > 1;
  
  SELECT COUNT(DISTINCT keeper_deal_id) INTO keeper_count
  FROM deal_duplicates
  WHERE rn > 1;
  
  RAISE NOTICE 'Found % duplicate deals across % patient+service combinations', 
    duplicate_count, keeper_count;
END $$;

-- Update emails to point to keeper deal
UPDATE emails e
SET deal_id = dd.keeper_deal_id
FROM deal_duplicates dd
WHERE e.deal_id = dd.deal_id
  AND dd.rn > 1
  AND dd.deal_id != dd.keeper_deal_id;

-- Update documents to point to keeper deal
UPDATE documents d
SET deal_id = dd.keeper_deal_id
FROM deal_duplicates dd
WHERE d.deal_id = dd.deal_id
  AND dd.rn > 1
  AND dd.deal_id != dd.keeper_deal_id;

-- Update chat_conversations to point to keeper deal
UPDATE chat_conversations cc
SET deal_id = dd.keeper_deal_id,
    updated_at = NOW()
FROM deal_duplicates dd
WHERE cc.deal_id = dd.deal_id
  AND dd.rn > 1
  AND dd.deal_id != dd.keeper_deal_id;

-- Update deal_notifications to point to keeper deal
UPDATE deal_notifications dn
SET deal_id = dd.keeper_deal_id
FROM deal_duplicates dd
WHERE dn.deal_id = dd.deal_id
  AND dd.rn > 1
  AND dd.deal_id != dd.keeper_deal_id;

-- Consolidate deal data before deletion (merge notes and values)
UPDATE deals d
SET 
  notes = COALESCE(d.notes, '') || 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM deal_duplicates dd 
        WHERE dd.keeper_deal_id = d.id 
          AND dd.rn > 1
      ) THEN (
        SELECT E'\n\n--- MERGED DEALS ---\n' || STRING_AGG(
          E'Deal from ' || TO_CHAR(dup_deals.created_at, 'YYYY-MM-DD HH24:MI') || 
          CASE 
            WHEN dup_deals.notes IS NOT NULL AND dup_deals.notes != '' 
            THEN E':\n' || dup_deals.notes 
            ELSE '' 
          END,
          E'\n---\n'
        )
        FROM deals dup_deals
        INNER JOIN deal_duplicates dd ON dup_deals.id = dd.deal_id
        WHERE dd.keeper_deal_id = d.id 
          AND dd.rn > 1
          AND dd.deal_id != dd.keeper_deal_id
      )
      ELSE ''
    END,
  updated_at = NOW()
WHERE d.id IN (
  SELECT DISTINCT keeper_deal_id 
  FROM deal_duplicates 
  WHERE rn > 1
);

-- Delete duplicate deals (keeping only rn=1 for each patient+service group)
DELETE FROM deals
WHERE id IN (
  SELECT deal_id 
  FROM deal_duplicates 
  WHERE rn > 1
);

-- Log final results
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Successfully merged and deleted % duplicate deals', deleted_count;
END $$;

-- Clean up temp table
DROP TABLE deal_duplicates;

COMMIT;
