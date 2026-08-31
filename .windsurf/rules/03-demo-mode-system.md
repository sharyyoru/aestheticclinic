# Demo Mode System

## Overview

Demo mode provides complete data isolation for demonstration purposes. Demo users see only demo data; real users never see demo data.

## Architecture

### Database Layer

Every table that contains user data has an `is_demo` boolean column:

```sql
-- Add is_demo column to any table
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS patients_is_demo_idx ON patients(is_demo);
```

### Helper Functions

```sql
-- Check if current user is a demo user
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

### RLS Policies

```sql
-- Demo data isolation policy
CREATE POLICY "Demo data isolation"
ON patients FOR ALL
TO authenticated
USING (is_demo = is_current_user_demo());
```

## Auto-Seed Demo Data

### Seed Function Pattern

```sql
CREATE OR REPLACE FUNCTION seed_demo_data(demo_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_count int;
BEGIN
  -- Check if already seeded (idempotent)
  SELECT count(*) INTO existing_count FROM patients WHERE is_demo = true;
  IF existing_count >= 100 THEN
    RETURN jsonb_build_object('status', 'already_seeded');
  END IF;

  -- Seed patients
  INSERT INTO patients (id, first_name, last_name, is_demo)
  VALUES 
    ('d0000003-0001-...', 'Demo', 'Patient 1', true),
    ('d0000003-0002-...', 'Demo', 'Patient 2', true)
  ON CONFLICT (id) DO NOTHING;

  -- Seed other tables...
  
  RETURN jsonb_build_object('status', 'seeded');
END;
$$;
```

### API Route for Auto-Setup

```typescript
// src/app/api/demo/ensure-user/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demotest";

export async function POST() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check if demo user exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const demoUser = existingUsers?.users?.find(u => u.email === DEMO_EMAIL);

  let userId: string;

  if (demoUser) {
    userId = demoUser.id;
  } else {
    // Create demo user
    const { data: newUser, error } = await adminClient.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    userId = newUser.user.id;
  }

  // Upsert user record
  await adminClient.from("users").upsert({
    id: userId,
    email: DEMO_EMAIL,
    full_name: "Demo User",
    role: "admin",
    is_demo: true,
  }, { onConflict: "id" });

  // Seed demo data
  await adminClient.rpc("seed_demo_data", { demo_user_id: userId });

  return NextResponse.json({ success: true, userId });
}
```

## Standalone Demo Page

Create a standalone login page that bypasses the main app shell:

```typescript
// src/app/demo/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DemoLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [initializing, setInitializing] = useState(true);

  // Ensure demo user exists on mount
  useEffect(() => {
    async function ensureDemoUser() {
      try {
        await fetch("/api/demo/ensure-user", { method: "POST" });
      } finally {
        setInitializing(false);
      }
    }
    ensureDemoUser();
  }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Login form */}
    </div>
  );
}
```

### Register as Standalone Route

```typescript
// src/components/RequireAuth.tsx
const PUBLIC_ROUTES = ["/login", "/demo", "/book-appointment"];

// src/components/LayoutShellSwitch.tsx
const STANDALONE_ROUTES = ["/login", "/demo", "/book-appointment"];
```

## Adding Demo Support to New Tables

1. **Add column**:
   ```sql
   ALTER TABLE new_table
     ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
   ```

2. **Add index**:
   ```sql
   CREATE INDEX new_table_is_demo_idx ON new_table(is_demo);
   ```

3. **Add RLS policy**:
   ```sql
   CREATE POLICY "Demo isolation" ON new_table
   FOR ALL TO authenticated
   USING (is_demo = is_current_user_demo());
   ```

4. **Update seed function** to include demo data for new table

## Demo Data Patterns

### UUID Convention
Use predictable UUIDs for demo data to prevent duplicates:
```
d0000001-XXXX-0000-0000-000000000001  -- Providers
d0000002-XXXX-0000-0000-000000000001  -- Deal stages
d0000003-XXXX-0000-0000-000000000001  -- Patients
d0000004-XXXX-0000-0000-000000000001  -- Appointments
```

### Idempotent Inserts
```sql
INSERT INTO patients (id, first_name, is_demo)
VALUES ('d0000003-0001-...', 'Demo', true)
ON CONFLICT (id) DO NOTHING;
```

## Verification

```sql
-- Check demo data counts
SELECT 'patients' as table_name, count(*) FROM patients WHERE is_demo = true
UNION ALL
SELECT 'appointments', count(*) FROM appointments WHERE is_demo = true
UNION ALL
SELECT 'deals', count(*) FROM deals WHERE is_demo = true;

-- Verify user demo status
SELECT id, email, is_demo FROM users WHERE email = 'demo@example.com';
```
