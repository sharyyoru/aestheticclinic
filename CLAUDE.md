# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A comprehensive CRM/ERP system for Swiss aesthetic medical clinics. Built with Next.js 15 (App Router) + React 19 + Supabase (PostgreSQL). Handles patient management, appointment scheduling, Swiss medical billing (SUMEX/TarDoc), insurance, document editing, and multi-channel communication (email, WhatsApp, in-app chat).

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run lint         # Run ESLint
npm run whatsapp     # Start WhatsApp server (server/whatsapp-server.js)
```

No test suite is configured.

**WhatsApp server (separate Node app):**
```bash
cd whatsapp-server && npm install && npm start
```

## Architecture

### Stack
- **Frontend/Backend:** Next.js 15 App Router — pages in `src/app/`, API routes in `src/app/api/`
- **Database & Auth:** Supabase (PostgreSQL + Auth). Schema at `supabase/schema.sql`; migrations in `migrations/`
- **Styling:** Tailwind CSS 4
- **AI:** Google Gemini (`@google/generative-ai`)
- **Email:** Mailgun (EU region)
- **SMS/WhatsApp:** Twilio + separate `whatsapp-server/` Express app (deployed on Railway)
- **Payments:** Payrexx
- **3D Imaging:** Crisalix OAuth integration

### Database Access
Two Supabase clients — always use the correct one:
- `src/lib/supabaseClient.ts` — browser-side, anon key, for client components
- `src/lib/supabaseAdmin.ts` — server-side, service role key, for API routes (bypasses RLS)

### Authentication
- `AuthContext` (`src/components/AuthContext.tsx`) provides `useAuth()` hook
- `RequireAuth` component wraps protected pages
- Public routes: `/login`, `/book-appointment`, `/intake`, `/form`, `/embed`, `/consultations`, `/onboarding`
- User roles stored in `users` table (`staff`, `admin`, `doctor`, `nurse`, etc.)

### State Management
React Context only — no Redux/Zustand. Key providers:
- `AuthContext` — current session
- `PatientTabsContext` — multi-patient tabs (open multiple patients simultaneously)
- `CommentsUnreadContext`, `TasksNotificationsContext`, `EmailNotificationsProvider` — notification badges

### API Routes
RESTful routes under `src/app/api/`. Caching is disabled for all `/api/*` routes via `middleware.ts`. Vercel cron runs `POST /api/cron/send-scheduled-emails` hourly.

### Swiss Medical Billing (Key Domain)
Complex billing logic lives in `src/lib/`:
- `sumexInvoice.ts` — SUMEX XML invoice generation (Swiss standard, 71KB)
- `tardoc.ts` — TarDoc medical procedure codes (31KB)
- `medidata.ts` — Medidata patient/provider lookup (19KB)
- `swissQrBill.ts` — Swiss QR Bill generation

### Document Editing
- Slate-based rich text editor for in-app DOCX editing
- Fabric.js for canvas/image annotation
- PDF generation via jsPDF + pdf-lib
- OnlyOffice integration for external document editing

### Deployment
- **Main app:** Vercel — `vercel.json` configures CSP headers for `/embed` pages and hourly cron
- **WhatsApp server:** Railway — `whatsapp-server/Dockerfile`, restart on failure

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
MAILGUN_API_KEY
MAILGUN_DOMAIN
MAILGUN_FROM_EMAIL
MAILGUN_FROM_NAME
MAILGUN_API_BASE_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
CRISALIX_CLIENT_ID
CRISALIX_CLIENT_SECRET
CRISALIX_TOKEN_URL
CRISALIX_API_BASE_URL
CRISALIX_OAUTH_AUTHORIZE_URL
CRISALIX_REDIRECT_URI
PAYREXX_INSTANCE
PAYREXX_API_SECRET
NEXT_PUBLIC_APP_URL
```

## Key Conventions

- Path alias `@/*` maps to `src/*` (configured in `tsconfig.json`)
- All DB queries use Supabase JS SDK directly (no ORM): `.from('table').select().eq()`
- API routes use `NextResponse.json()` with explicit HTTP status codes
- Client components fetch from `/api/` routes; server components may use `supabaseAdmin` directly
