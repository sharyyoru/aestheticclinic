-- Migration: Reassign ALL tasks from Wilson to Sales Team (Round-Robin)
-- Date: 2026-01-10
-- Description: Redistributes ALL tasks currently assigned to Wilson
--              to the 5 sales team members in round-robin fashion

-- STEP 1: First, check if we have the sales team users in auth.users
-- Run this query first to get user IDs:
-- SELECT id, raw_user_meta_data->>'full_name' as name FROM auth.users;

-- STEP 2: Direct reassignment using auth.users metadata
-- This version uses auth.users table which is where Supabase stores users

WITH sales_team AS (
  SELECT 
    id,
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'first_name',
      email
    ) as full_name,
    ROW_NUMBER() OVER (ORDER BY email) - 1 as team_index
  FROM auth.users
  WHERE LOWER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name', email)) LIKE '%charline%'
     OR LOWER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name', email)) LIKE '%elite%'
     OR LOWER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name', email)) LIKE '%audrey%'
     OR LOWER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name', email)) LIKE '%bubuque%'
     OR LOWER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name', email)) LIKE '%victoria%'
),
wilson_user AS (
  SELECT id 
  FROM auth.users 
  WHERE LOWER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'first_name', email)) LIKE '%wilson%'
  LIMIT 1
),
numbered_tasks AS (
  SELECT 
    t.id,
    ROW_NUMBER() OVER (ORDER BY t.created_at) - 1 as task_index
  FROM tasks t, wilson_user w
  WHERE t.assigned_user_id = w.id
    OR LOWER(t.assigned_user_name) LIKE '%wilson%'
),
team_count AS (
  SELECT COUNT(*) as cnt FROM sales_team
),
task_assignments AS (
  SELECT 
    nt.id as task_id,
    st.id as new_user_id,
    st.full_name as new_user_name
  FROM numbered_tasks nt
  CROSS JOIN team_count tc
  JOIN sales_team st ON st.team_index = (nt.task_index % tc.cnt)
  WHERE tc.cnt > 0
)
UPDATE tasks t
SET 
  assigned_user_id = ta.new_user_id,
  assigned_user_name = ta.new_user_name,
  updated_at = NOW()
FROM task_assignments ta
WHERE t.id = ta.task_id;

-- Verification query:
-- SELECT assigned_user_name, COUNT(*) as task_count 
-- FROM tasks 
-- GROUP BY assigned_user_name 
-- ORDER BY task_count DESC;
