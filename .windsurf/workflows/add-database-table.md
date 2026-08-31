---
description: Create a new database table with proper demo mode support and RLS
---

# Add Database Table

## 1. Create Migration File

Create `migrations/YYYYMMDD_table_name.sql`:

```sql
-- Create the table
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Data columns
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  
  -- Demo mode support (REQUIRED)
  is_demo BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS new_table_patient_id_idx ON new_table(patient_id);
CREATE INDEX IF NOT EXISTS new_table_is_demo_idx ON new_table(is_demo);
CREATE INDEX IF NOT EXISTS new_table_created_at_idx ON new_table(created_at);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view"
ON new_table FOR SELECT
TO authenticated
USING (is_demo = is_current_user_demo());

CREATE POLICY "Authenticated users can insert"
ON new_table FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update"
ON new_table FOR UPDATE
TO authenticated
USING (is_demo = is_current_user_demo());

CREATE POLICY "Authenticated users can delete"
ON new_table FOR DELETE
TO authenticated
USING (is_demo = is_current_user_demo());
```

## 2. Run Migration

Execute in Supabase SQL Editor.

## 3. Update Schema File

Add the table definition to `supabase/schema.sql` for documentation.

## 4. Add Demo Data (Optional)

If the table should have demo data:

```sql
-- Add to seed_demo_data function or create separate migration
INSERT INTO new_table (id, patient_id, name, is_demo)
VALUES 
  ('d0000xxx-0001-0000-0000-000000000001', 
   'd0000003-0001-0000-0000-000000000001', 
   'Demo Item 1', 
   true)
ON CONFLICT (id) DO NOTHING;
```

## 5. Create TypeScript Types

Add to appropriate types file or create new one:

```typescript
// src/types/newTable.ts
export interface NewTable {
  id: string;
  patient_id: string;
  name: string;
  status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}
```

## 6. Verify

```sql
-- Check table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'new_table';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'new_table';

-- Check policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'new_table';

-- Check demo isolation works
SELECT count(*) FROM new_table WHERE is_demo = true;
```

## Checklist

- [ ] Table has `is_demo` column with `NOT NULL DEFAULT false`
- [ ] Index created for `is_demo` column
- [ ] RLS enabled on table
- [ ] Policies use `is_current_user_demo()` for isolation
- [ ] Foreign key constraints are appropriate (CASCADE vs SET NULL)
- [ ] Schema file updated
- [ ] TypeScript types created
