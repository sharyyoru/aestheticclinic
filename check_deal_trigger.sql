-- Check if the deal deduplication trigger exists

-- Query 1: Check if the trigger exists
SELECT 
  tgname as trigger_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'check_duplicate_deals_before_insert';

-- Query 2: Check if the trigger function exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'prevent_duplicate_deals';

-- Query 3: List all triggers on the deals table
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as is_enabled,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'deals'
  AND t.tgisinternal = false;

-- Expected results:
-- If trigger exists: You should see 'check_duplicate_deals_before_insert' in Query 1 and 3
-- If function exists: You should see 'prevent_duplicate_deals' in Query 2
-- If nothing shows up: The migration hasn't been run yet
