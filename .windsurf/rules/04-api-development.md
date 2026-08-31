# API Development

## Route File Structure

```
src/app/api/
├── patients/
│   ├── route.ts              # GET all, POST create
│   └── [id]/
│       └── route.ts          # GET one, PUT update, DELETE
├── appointments/
│   └── route.ts
└── cron/
    └── send-scheduled-emails/
        └── route.ts
```

## Basic API Route Pattern

```typescript
// src/app/api/patients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/patients
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("*")
      .limit(limit)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching patients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/patients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.first_name || !body.last_name) {
      return NextResponse.json(
        { error: "first_name and last_name are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("patients")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Dynamic Route Pattern

```typescript
// src/app/api/patients/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { id: string } };

// GET /api/patients/:id
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = params;

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/patients/:id
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = params;
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("patients")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/patients/:id
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = params;

  const { error } = await supabaseAdmin
    .from("patients")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

## Authentication in API Routes

```typescript
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proceed with authenticated request
  const userId = session.user.id;
  // ...
}
```

## Response Patterns

```typescript
// Success responses
return NextResponse.json(data);                           // 200 OK
return NextResponse.json(data, { status: 201 });          // 201 Created
return NextResponse.json({ success: true });              // 200 OK (action)
return new NextResponse(null, { status: 204 });           // 204 No Content

// Error responses
return NextResponse.json({ error: "Not found" }, { status: 404 });
return NextResponse.json({ error: "Bad request" }, { status: 400 });
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
return NextResponse.json({ error: "Forbidden" }, { status: 403 });
return NextResponse.json({ error: "Server error" }, { status: 500 });
```

## Caching Configuration

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Disable caching for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }
  
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
```

## Cron Jobs

```typescript
// src/app/api/cron/send-scheduled-emails/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  // Verify cron secret (Vercel)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Process scheduled emails
  const { data: emails } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  for (const email of emails || []) {
    // Send email...
  }

  return NextResponse.json({ processed: emails?.length || 0 });
}
```

Configure in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/send-scheduled-emails",
      "schedule": "0 * * * *"
    }
  ]
}
```

## File Uploads

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { data, error } = await supabaseAdmin.storage
    .from("documents")
    .upload(`uploads/${file.name}`, buffer, {
      contentType: file.type,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path: data.path });
}
```

## External API Calls

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch("https://api.external.com/endpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.EXTERNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "External API error" },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
```
