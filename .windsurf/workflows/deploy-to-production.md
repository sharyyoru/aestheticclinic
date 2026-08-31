---
description: Deploy application changes to production (Vercel + Railway)
---

# Deploy to Production

## Pre-Deployment Checks

### 1. Type Check

```bash
// turbo
npx tsc --noEmit
```

All TypeScript errors must be resolved.

### 2. Build Check (Optional)

```bash
npm run build -- --no-lint
```

Ensures the production build succeeds.

### 3. Test Locally

```bash
npm run dev
```

Verify all changes work as expected.

## Deploy Main App (Vercel)

### 1. Commit and Push

```bash
git add -A
git commit -m "feat: description of changes"
git push
```

Vercel auto-deploys on push to `main` branch.

### 2. Monitor Deployment

- Check Vercel dashboard for build status
- Review build logs for any errors
- Wait for deployment to complete (usually 1-3 minutes)

### 3. Verify Production

- Visit production URL
- Test critical paths:
  - [ ] Login works
  - [ ] Patient list loads
  - [ ] Appointments display
  - [ ] New feature works

## Deploy WhatsApp Server (Railway)

If changes affect `whatsapp-server/`:

### 1. Push Changes

```bash
git add -A
git commit -m "fix: whatsapp server changes"
git push
```

Railway auto-deploys on push.

### 2. Monitor Railway

- Check Railway dashboard
- View deployment logs
- Verify health checks pass

## Database Migrations

If you have new SQL migrations:

### 1. Run in Supabase

Go to Supabase Dashboard → SQL Editor → Run migration script.

### 2. Verify

```sql
-- Check table/column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'your_table';

-- Check RLS policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'your_table';
```

## Environment Variables

If new env vars are needed:

### Vercel
1. Go to Vercel Project Settings → Environment Variables
2. Add variable for Production environment
3. Redeploy for changes to take effect

### Railway
1. Go to Railway Project → Variables
2. Add or update variables
3. Service will auto-restart

## Rollback (if needed)

### Vercel
1. Go to Deployments tab
2. Find last working deployment
3. Click "..." → "Promote to Production"

### Railway
1. Go to Deployments
2. Find previous deployment
3. Click "Rollback"

### Database
If migration caused issues, create a new migration to revert:

```sql
-- Revert migration
ALTER TABLE table_name DROP COLUMN new_column;
```

## Post-Deployment

- [ ] Test critical user flows
- [ ] Check error monitoring (if configured)
- [ ] Notify team of deployment
- [ ] Update documentation if needed
