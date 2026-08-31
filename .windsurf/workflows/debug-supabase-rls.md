---
description: Troubleshoot Row Level Security (RLS) issues in Supabase
---

# Debug Supabase RLS

## Common Symptoms

- "No rows returned" when data exists
- User sees wrong data (demo vs real)
- Insert/update silently fails
- Permission denied errors

## Step 1: Check RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'your_table';
```

Expected: `rowsecurity = true`

## Step 2: List Policies

```sql
SELECT 
  policyname,
  cmd,
  qual,           -- USING clause (for SELECT, UPDATE, DELETE)
  with_check      -- WITH CHECK clause (for INSERT, UPDATE)
FROM pg_policies
WHERE tablename = 'your_table';
```

## Step 3: Test Demo Function

```sql
-- Check if demo function exists and works
SELECT is_current_user_demo();

-- Should return true for demo users, false otherwise
```

If this returns NULL or errors, the function is missing:

```sql
CREATE OR REPLACE FUNCTION is_current_user_demo()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_demo FROM users WHERE id = auth.uid()),
    false
  );
$$;
```

## Step 4: Verify User Record

```sql
-- Check user exists and has correct is_demo flag
SELECT id, email, is_demo, role
FROM users
WHERE id = auth.uid();

-- Or by email
SELECT id, email, is_demo, role
FROM users
WHERE email = 'user@example.com';
```

## Step 5: Test Policy Manually

```sql
-- Test what the policy evaluates to
SELECT 
  id,
  is_demo,
  is_demo = is_current_user_demo() as policy_allows
FROM your_table
LIMIT 10;
```

## Step 6: Bypass RLS (Admin Testing)

Use `supabaseAdmin` client (service role) to bypass RLS:

```typescript
// This bypasses RLS - use only for debugging
const { data } = await supabaseAdmin
  .from("your_table")
  .select("*");
```

## Common Fixes

### Missing is_demo Column

```sql
ALTER TABLE your_table
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS your_table_is_demo_idx 
ON your_table(is_demo);
```

### Missing Policy

```sql
CREATE POLICY "Demo isolation" ON your_table
FOR ALL TO authenticated
USING (is_demo = is_current_user_demo());
```

### Policy Uses Wrong Logic

Drop and recreate:

```sql
DROP POLICY IF EXISTS "old_policy_name" ON your_table;

CREATE POLICY "correct_policy" ON your_table
FOR ALL TO authenticated
USING (is_demo = is_current_user_demo());
```

### User Not Marked as Demo

```sql
UPDATE users
SET is_demo = true
WHERE email = 'demo@example.com';
```

### User Missing from Users Table

```sql
-- Get auth user ID
SELECT id FROM auth.users WHERE email = 'user@example.com';

-- Insert into users table
INSERT INTO users (id, email, role, is_demo)
VALUES ('uuid-from-above', 'user@example.com', 'staff', false)
ON CONFLICT (id) DO UPDATE SET is_demo = false;
```

## RLS Policy Template

Standard policy that handles demo isolation:

```sql
-- Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "your_table_select" ON your_table;
DROP POLICY IF EXISTS "your_table_insert" ON your_table;
DROP POLICY IF EXISTS "your_table_update" ON your_table;
DROP POLICY IF EXISTS "your_table_delete" ON your_table;

-- Create new policies with demo isolation
CREATE POLICY "your_table_select" ON your_table
FOR SELECT TO authenticated
USING (is_demo = is_current_user_demo());

CREATE POLICY "your_table_insert" ON your_table
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "your_table_update" ON your_table
FOR UPDATE TO authenticated
USING (is_demo = is_current_user_demo());

CREATE POLICY "your_table_delete" ON your_table
FOR DELETE TO authenticated
USING (is_demo = is_current_user_demo());
```

## Verify Fix

After applying fixes:

```sql
-- Count records visible to current user
SELECT count(*) FROM your_table;

-- Should match expected count based on is_demo status
SELECT count(*), is_demo FROM your_table GROUP BY is_demo;
```
