-- Migration: Reassign "New Request Open" tasks from Wilson to Sales Team (Round-Robin)
-- Date: 2026-01-10
-- Description: Redistributes all "New Request Open" tasks currently assigned to Wilson
--              to the 5 sales team members (Charline, Elite, Audrey, Bubuque, Victoria) in round-robin fashion

-- Step 1: Create a temporary table to store the sales team user IDs and names
CREATE TEMP TABLE sales_team_users AS
SELECT id, full_name, email,
       ROW_NUMBER() OVER (ORDER BY full_name) - 1 as team_index
FROM users
WHERE LOWER(full_name) LIKE '%charline%'
   OR LOWER(full_name) LIKE '%elite%'
   OR LOWER(full_name) LIKE '%audrey%'
   OR LOWER(full_name) LIKE '%bubuque%'
   OR LOWER(full_name) LIKE '%victoria%';

-- Step 2: Get Wilson's user ID
CREATE TEMP TABLE wilson_user AS
SELECT id, full_name
FROM users
WHERE LOWER(full_name) LIKE '%wilson%'
LIMIT 1;

-- Step 3: Get the count of sales team members for round-robin calculation
DO $$
DECLARE
    team_count INT;
    wilson_id UUID;
BEGIN
    -- Get team count
    SELECT COUNT(*) INTO team_count FROM sales_team_users;
    
    -- Get Wilson's ID
    SELECT id INTO wilson_id FROM wilson_user LIMIT 1;
    
    -- Only proceed if we have sales team members and Wilson exists
    IF team_count > 0 AND wilson_id IS NOT NULL THEN
        -- Update tasks with round-robin assignment
        WITH numbered_tasks AS (
            SELECT 
                t.id,
                ROW_NUMBER() OVER (ORDER BY t.created_at) - 1 as task_index
            FROM tasks t
            WHERE t.assigned_user_id = wilson_id
              AND (t.name LIKE '%New Request%' OR t.name LIKE '%new request%')
              AND t.status = 'not_started'
        ),
        task_assignments AS (
            SELECT 
                nt.id as task_id,
                stu.id as new_user_id,
                stu.full_name as new_user_name
            FROM numbered_tasks nt
            JOIN sales_team_users stu ON stu.team_index = (nt.task_index % team_count)
        )
        UPDATE tasks t
        SET 
            assigned_user_id = ta.new_user_id,
            assigned_user_name = ta.new_user_name,
            updated_at = NOW()
        FROM task_assignments ta
        WHERE t.id = ta.task_id;
        
        RAISE NOTICE 'Reassigned tasks from Wilson to sales team (% members)', team_count;
    ELSE
        RAISE NOTICE 'No sales team members found or Wilson not found. Team count: %, Wilson ID: %', team_count, wilson_id;
    END IF;
END $$;

-- Step 4: Clean up temporary tables
DROP TABLE IF EXISTS sales_team_users;
DROP TABLE IF EXISTS wilson_user;

-- Verification query (run manually to check results):
-- SELECT assigned_user_name, COUNT(*) as task_count 
-- FROM tasks 
-- WHERE name LIKE '%New Request%' 
-- GROUP BY assigned_user_name 
-- ORDER BY assigned_user_name;
