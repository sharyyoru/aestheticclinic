-- Migration: Add owner_id and owner_name columns to deals table
-- Date: 2026-05-05
-- Description: Ensures deals can have an owner assigned (same as task assignee for Request for Information stage)

-- Step 1: Add owner_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added owner_id column to deals table';
  ELSE
    RAISE NOTICE 'owner_id column already exists on deals table';
  END IF;
END $$;

-- Step 2: Add owner_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE deals ADD COLUMN owner_name TEXT;
    RAISE NOTICE 'Added owner_name column to deals table';
  ELSE
    RAISE NOTICE 'owner_name column already exists on deals table';
  END IF;
END $$;

-- Step 3: Create index on owner_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);

-- Step 4: Update existing deals in "Request for Information" stage that have no owner
-- but have associated tasks with an assignee
DO $$
DECLARE
  request_info_stage_id UUID;
  updated_count INTEGER := 0;
BEGIN
  -- Find the "Request for Information" stage
  SELECT id INTO request_info_stage_id
  FROM deal_stages
  WHERE LOWER(name) LIKE '%request for information%'
  LIMIT 1;

  IF request_info_stage_id IS NOT NULL THEN
    -- Update deals that have no owner but have a task with an assignee
    WITH deals_to_update AS (
      SELECT DISTINCT ON (d.id) 
        d.id as deal_id,
        t.assigned_user_id,
        t.assigned_user_name
      FROM deals d
      JOIN tasks t ON t.patient_id = d.patient_id
      WHERE d.stage_id = request_info_stage_id
        AND d.owner_id IS NULL
        AND t.assigned_user_id IS NOT NULL
      ORDER BY d.id, t.created_at DESC
    )
    UPDATE deals d
    SET 
      owner_id = dtu.assigned_user_id,
      owner_name = dtu.assigned_user_name,
      updated_at = NOW()
    FROM deals_to_update dtu
    WHERE d.id = dtu.deal_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % deals with owner from associated tasks', updated_count;
  ELSE
    RAISE NOTICE 'Request for Information stage not found, skipping deal owner update';
  END IF;
END $$;
