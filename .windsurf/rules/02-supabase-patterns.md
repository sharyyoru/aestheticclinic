# Supabase Patterns

## Two Clients — Use the Correct One

### Browser Client (Client Components)
```typescript
// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Use for:**
- Client components (`"use client"`)
- Browser-side authentication
- Real-time subscriptions
- User-scoped queries (RLS applies)

### Admin Client (API Routes & Server)
```typescript
// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

**Use for:**
- API routes
- Server components
- Background jobs
- Admin operations (bypasses RLS)

## Query Patterns

### Basic CRUD
```typescript
// SELECT
const { data, error } = await supabase
  .from("patients")
  .select("*")
  .eq("id", patientId)
  .single();

// INSERT
const { data, error } = await supabase
  .from("patients")
  .insert({ first_name: "John", last_name: "Doe" })
  .select()
  .single();

// UPDATE
const { error } = await supabase
  .from("patients")
  .update({ first_name: "Jane" })
  .eq("id", patientId);

// DELETE
const { error } = await supabase
  .from("patients")
  .delete()
  .eq("id", patientId);
```

### Joins & Relations
```typescript
// Join with foreign table
const { data } = await supabase
  .from("appointments")
  .select(`
    *,
    patient:patients(id, first_name, last_name),
    provider:providers(id, name)
  `)
  .eq("status", "scheduled");
```

### Pagination
```typescript
const { data, count } = await supabase
  .from("patients")
  .select("*", { count: "exact" })
  .range(0, 9)  // First 10 records
  .order("created_at", { ascending: false });
```

## Row Level Security (RLS)

### Enable RLS on Tables
```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
```

### Common Policy Patterns
```sql
-- Authenticated users can view all
CREATE POLICY "Authenticated users can view patients"
ON patients FOR SELECT
TO authenticated
USING (true);

-- Users can only edit their own records
CREATE POLICY "Users can update own records"
ON patients FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

-- Demo data isolation (see 03-demo-mode-system.md)
CREATE POLICY "Demo isolation"
ON patients FOR ALL
TO authenticated
USING (is_demo = is_current_user_demo());
```

## Authentication

### Auth Context
```typescript
// src/components/AuthContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Protected Routes
```typescript
// src/components/RequireAuth.tsx
"use client";
import { useAuth } from "./AuthContext";
import { redirect } from "next/navigation";

const PUBLIC_ROUTES = ["/login", "/demo", "/book-appointment"];

export function RequireAuth({ children }) {
  const { session } = useAuth();
  const pathname = usePathname();

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return children;
  }

  if (!session) {
    redirect("/login");
  }

  return children;
}
```

### Sign In/Out
```typescript
// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

## Real-time Subscriptions

```typescript
useEffect(() => {
  const channel = supabase
    .channel("patients-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "patients" },
      (payload) => {
        console.log("Change received!", payload);
        // Update local state
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from("documents")
  .upload(`patient-${patientId}/${fileName}`, file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from("documents")
  .getPublicUrl(filePath);

// Download file
const { data, error } = await supabase.storage
  .from("documents")
  .download(filePath);
```

## Error Handling

```typescript
const { data, error } = await supabase
  .from("patients")
  .select("*");

if (error) {
  console.error("Database error:", error.message);
  // Handle specific error codes
  if (error.code === "PGRST116") {
    // No rows returned
  }
  return null;
}

return data;
```
