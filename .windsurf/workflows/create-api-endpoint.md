---
description: Create a new API endpoint with proper error handling and authentication
---

# Create API Endpoint

## 1. Determine Route Structure

```
src/app/api/
├── resource/
│   ├── route.ts           # GET all, POST create
│   └── [id]/
│       └── route.ts       # GET one, PUT update, DELETE
```

## 2. Create Route File

```typescript
// src/app/api/resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/resource
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data, error, count } = await supabaseAdmin
      .from("resource")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/resource
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.requiredField) {
      return NextResponse.json(
        { error: "requiredField is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("resource")
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## 3. Add Dynamic Route (if needed)

```typescript
// src/app/api/resource/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = params;

  const { data, error } = await supabaseAdmin
    .from("resource")
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

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = params;
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("resource")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = params;

  const { error } = await supabaseAdmin
    .from("resource")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
```

## 4. Test the Endpoint

```bash
# GET all
curl http://localhost:3000/api/resource

# GET one
curl http://localhost:3000/api/resource/uuid-here

# POST create
curl -X POST http://localhost:3000/api/resource \
  -H "Content-Type: application/json" \
  -d '{"requiredField": "value"}'

# PUT update
curl -X PUT http://localhost:3000/api/resource/uuid-here \
  -H "Content-Type: application/json" \
  -d '{"field": "new-value"}'

# DELETE
curl -X DELETE http://localhost:3000/api/resource/uuid-here
```

## 5. Type Check

```bash
// turbo
npx tsc --noEmit
```

## Checklist

- [ ] Use `supabaseAdmin` for server-side queries
- [ ] Validate required fields (return 400 for invalid input)
- [ ] Handle database errors (return 500 with message)
- [ ] Handle not found (return 404 for missing records)
- [ ] Log errors with `console.error`
- [ ] Return appropriate status codes
- [ ] Use `NextResponse.json()` for all responses
