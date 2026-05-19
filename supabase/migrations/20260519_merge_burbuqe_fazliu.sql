-- Migration: Merge duplicate Burbuqe Fazliu user records
-- Date: 2026-05-19
-- Description: Finds duplicate user records for Burbuqe Fazliu, merges their data,
--              reassigns tasks and deals to the primary record, and removes duplicates

-- Step 1: Find all Burbuqe Fazliu users in public.users table
-- First, let's identify them
DO $$
DECLARE
  primary_user_id UUID;
  duplicate_user_id UUID;
  user_record RECORD;
  duplicate_count INT := 0;
BEGIN
  -- Find all users with name containing 'burbuqe' or 'fazliu' (case-insensitive)
  FOR user_record IN 
    SELECT id, email, full_name, role, created_at
    FROM users 
    WHERE LOWER(full_name) LIKE '%burbuqe%' 
       OR LOWER(full_name) LIKE '%fazliu%'
       OR LOWER(email) LIKE '%burbuqe%'
       OR LOWER(email) LIKE '%fazliu%'
    ORDER BY created_at ASC
  LOOP
    RAISE NOTICE 'Found user: id=%, email=%, full_name=%, created_at=%', 
      user_record.id, user_record.email, user_record.full_name, user_record.created_at;
    
    IF duplicate_count = 0 THEN
      primary_user_id := user_record.id;
      RAISE NOTICE 'Primary user set to: %', primary_user_id;
    ELSE
      duplicate_user_id := user_record.id;
      RAISE NOTICE 'Duplicate user found: %', duplicate_user_id;
      
      -- Reassign tasks from duplicate to primary
      UPDATE tasks 
      SET assigned_user_id = primary_user_id,
          assigned_user_name = (SELECT full_name FROM users WHERE id = primary_user_id),
          updated_at = NOW()
      WHERE assigned_user_id = duplicate_user_id;
      
      RAISE NOTICE 'Reassigned tasks from % to %', duplicate_user_id, primary_user_id;
      
      -- Reassign deals (owner) from duplicate to primary
      UPDATE deals 
      SET owner_id = primary_user_id,
          owner_name = (SELECT full_name FROM users WHERE id = primary_user_id),
          updated_at = NOW()
      WHERE owner_id = duplicate_user_id;
      
      RAISE NOTICE 'Reassigned deal ownership from % to %', duplicate_user_id, primary_user_id;
      
      -- Reassign deals (created_by) from duplicate to primary
      UPDATE deals 
      SET created_by_id = primary_user_id,
          created_by_name = (SELECT full_name FROM users WHERE id = primary_user_id),
          updated_at = NOW()
      WHERE created_by_id = duplicate_user_id;
      
      RAISE NOTICE 'Reassigned deal created_by from % to %', duplicate_user_id, primary_user_id;
      
      -- Reassign workflow enrollments
      UPDATE workflow_enrollments 
      SET enrolled_by = primary_user_id
      WHERE enrolled_by = duplicate_user_id;
      
      -- Reassign comments
      UPDATE comments
      SET user_id = primary_user_id
      WHERE user_id = duplicate_user_id;
      
      -- Reassign activity logs if they reference user
      UPDATE activity_log
      SET user_id = primary_user_id
      WHERE user_id = duplicate_user_id;
      
      -- Delete the duplicate from public.users (NOT from auth.users - that requires admin API)
      DELETE FROM users WHERE id = duplicate_user_id;
      
      RAISE NOTICE 'Deleted duplicate user % from public.users', duplicate_user_id;
    END IF;
    
    duplicate_count := duplicate_count + 1;
  END LOOP;
  
  IF duplicate_count > 1 THEN
    RAISE NOTICE 'Successfully merged % duplicate users into primary user %', duplicate_count - 1, primary_user_id;
  ELSIF duplicate_count = 1 THEN
    RAISE NOTICE 'Only one Burbuqe Fazliu user found, no merge needed';
  ELSE
    RAISE NOTICE 'No Burbuqe Fazliu users found';
  END IF;
END $$;

-- Verification queries (run manually after migration):
-- SELECT id, email, full_name FROM users WHERE LOWER(full_name) LIKE '%burbuqe%' OR LOWER(full_name) LIKE '%fazliu%';
-- SELECT assigned_user_id, assigned_user_name, COUNT(*) FROM tasks WHERE LOWER(assigned_user_name) LIKE '%burbuqe%' GROUP BY 1, 2;
-- SELECT owner_id, owner_name, COUNT(*) FROM deals WHERE LOWER(owner_name) LIKE '%burbuqe%' GROUP BY 1, 2;
