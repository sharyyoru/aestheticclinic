---
description: Standard workflow for adding a new feature to the clinic CRM
---

# Add New Feature

## 1. Understand Requirements

- Clarify what the feature should do
- Identify which pages/components are affected
- Determine if database changes are needed

## 2. Database Changes (if needed)

```sql
-- Create migration file: migrations/YYYYMMDD_feature_name.sql

-- Add new table or columns
ALTER TABLE existing_table
  ADD COLUMN new_column TEXT;

-- Add indexes for queries
CREATE INDEX IF NOT EXISTS idx_name ON table(column);

-- Add RLS policy
CREATE POLICY "policy_name" ON table
FOR ALL TO authenticated
USING (true);
```

Run in Supabase SQL Editor, then update `supabase/schema.sql`.

## 3. Create API Route (if needed)

```
src/app/api/feature-name/route.ts
```

Follow patterns in `.windsurf/rules/04-api-development.md`.

## 4. Implement UI Components

- Create new components in `src/components/`
- Add pages in `src/app/`
- Use existing UI patterns (check similar features)

## 5. Type Check

```bash
// turbo
npx tsc --noEmit
```

Fix any TypeScript errors before proceeding.

## 6. Test Locally

```bash
npm run dev
```

- Test happy path
- Test error cases
- Test edge cases (empty states, long text, etc.)

## 7. Commit and Push

```bash
git add -A
git commit -m "feat: add feature-name"
git push
```

## 8. Verify Deployment

- Check Vercel deployment logs
- Test on production URL
- Verify feature works as expected
