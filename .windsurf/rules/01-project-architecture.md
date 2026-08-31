# Project Architecture

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS 4
- **AI**: Google Gemini (`@google/generative-ai`)
- **Email**: Mailgun (EU region)
- **SMS/WhatsApp**: Twilio
- **Payments**: Payrexx (Swiss), Stripe
- **Deployment**: Vercel (main app), Railway (WhatsApp server)

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # API endpoints
│   ├── patients/          # Patient management pages
│   ├── appointments/      # Scheduling pages
│   ├── deals/             # Sales pipeline
│   └── ...
├── components/            # Shared React components
├── lib/                   # Utilities & business logic
│   ├── supabaseClient.ts  # Browser-side client (anon key)
│   ├── supabaseAdmin.ts   # Server-side client (service role)
│   ├── demoMode.ts        # Demo mode utilities
│   └── ...
└── utils/                 # Helper functions

supabase/
├── schema.sql             # Main database schema
└── migrations/            # Incremental migrations

migrations/                # Application-level migrations
```

## Path Aliases

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// Usage
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
```

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Pages | `page.tsx` | `app/patients/page.tsx` |
| Layouts | `layout.tsx` | `app/layout.tsx` |
| API Routes | `route.ts` | `app/api/patients/route.ts` |
| Components | PascalCase | `PatientCard.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Types | PascalCase | `Patient.ts` |

## Component Patterns

### Client Components
```typescript
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  
  useEffect(() => {
    // Fetch from API or Supabase
  }, []);
  
  return <div>...</div>;
}
```

### Server Components (Default)
```typescript
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function PatientPage({ params }) {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", params.id)
    .single();
    
  return <div>...</div>;
}
```

## State Management

React Context only — no Redux/Zustand:

- `AuthContext` — current session & user
- `PatientTabsContext` — multi-patient tabs
- `CommentsUnreadContext` — notification badges
- `TasksNotificationsContext` — task alerts

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GEMINI_API_KEY=

# Email
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM_EMAIL=

# WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=

# Payments
PAYREXX_INSTANCE=
PAYREXX_API_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

## Key Conventions

1. **Always use TypeScript** — no `.js` files
2. **Prefer server components** — use `"use client"` only when needed
3. **No ORM** — use Supabase JS SDK directly
4. **API routes return JSON** — use `NextResponse.json()`
5. **Explicit error handling** — always return proper HTTP status codes
