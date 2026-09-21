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

### Booking Contact Rules (`src/lib/bookingContact.ts`)
Four paths create bookings — public doctor pages, the website embed, the patient app, and the AI phone agent — so the contact-detail rules live in one helper. Do not re-implement them per path.
- Phone, date of birth, street, postal code and town must end up on the patient record, so a missed first appointment can be billed. A field is only demanded when the **stored record** lacks it.
- `fillOnlyEmpty()` is what persists a booking's details: it completes blank fields and **never overwrites** an existing value. Writing a matched patient's details back was the fix for online bookings silently discarding the phone number a patient had typed.
- `normalizeBookingPhone()` — use this, **not** `normalizePhone` from `src/lib/retell.ts`. The Retell helper maps a bare `79 123 45 67` to `+79…` (Russia), and that is the format the booking placeholders suggest. The Retell one is left alone because live call paths depend on it.
- The public API returns **422** with `code: "MISSING_PATIENT_DETAILS"` / `"INVALID_PATIENT_DETAILS"` so forms can highlight specific fields; 400 remains "identity/slot fields absent".
- Patient resolution in `api/public/book-appointment` happens **before** validation (needed to know what the record has) but patient *creation* stays **after** the availability check, so a rejected slot never leaves an orphan patient.
- AI phone bookings are exempt: they tag the appointment `[Details: pending]` and open a reception task instead of blocking.
- "Missing details" is **derived** from the patient record (`patientDetailsGaps`) — there is no column to backfill or keep in sync.

### Public Documentation Site (`/documentation`)
Public, SEO-indexed end-user docs — no auth, no app shell, always light themed.
- Pages: `src/app/documentation/page.tsx` (hub) + `[slug]/page.tsx` (one static page per module, via `generateStaticParams`)
- Content: typed data in `src/app/documentation/content/*.ts` (one file per category, registry in `index.ts`). **When you add or change a user-facing feature, update the matching module content file.**
- Renderers/components in `src/app/documentation/components/`; search index served statically from `src/app/documentation/search-index/route.ts` (fetched lazily by the ⌘K search)
- Public route registration requires 4 arrays: `PUBLIC_ROUTES` (RequireAuth), `STANDALONE_ROUTES` (LayoutShellSwitch + ShellVisibility), `HIDDEN_ROUTES` (PatientTabBar)
- `ForceLightTheme` strips `.dark` from `<html>` on docs routes — `ThemeProvider` defaults to dark globally and `globals.css` overrides `.dark [class*="rounded-xl"][class*="bg-white"]` with `!important`
- `src/app/sitemap.ts` and `src/app/robots.ts` allow the docs + public marketing pages and disallow all app/API routes
- Docs content must never include API endpoints, DB schema, env values or secrets

### Academy Capture Pipeline (`scripts/academy/`)
Generates the Academy from `/documentation` plus real screenshots and silent, caption-narrated screen recordings.

```bash
npm run academy:provision   # build the isolated capture DB (rare)
npm run academy:doctor      # assert-only: verify all 50 recipes still resolve
npm run academy:all         # capture → encode → publish → sync
npm run typecheck:scripts   # scripts/ are excluded from the app tsconfig
```

- **Academy content is generated, not hand-written.** 10 doc categories → `academy_modules`; 50 doc modules → `academy_lessons` (lesson slug = doc slug, so re-runs are idempotent upserts). Editing lesson content in the DB will be overwritten — change the doc content file instead.
- **NEVER capture against production.** `invoices`, `services`, insurance submissions and `leads` are not covered by the demo RLS policies, and the patient page plus 127 API routes render via the service-role key which bypasses RLS. Two guards enforce this (`lib/guards.ts`): abort if the target ref equals production, and abort if any `patients` row has `is_demo = false`. Both are load-bearing — do not weaken them.
- Capture DB schema is **generated from production's PostgREST spec** (`lib/ddlFromSpec.ts`), because 27 tables + 3 views the app queries have no `CREATE TABLE` anywhere in the repo (including all of `invoices`), and `supabase/schema.sql` is a stale 41-table snapshot. Reads schema metadata only, zero rows.
- `views.sql` holds **approximated** bodies for `v_debiteurs`, `v_invoices_enriched`, `v_invoice_lines_enriched` — the real definitions are not exposed by the spec. Replace them if the Debiteurs report matters.
- Applying DDL needs `CAPTURE_DB_URL` or `SUPABASE_ACCESS_TOKEN` in `.env.capture`; the anon/service_role keys cannot run DDL.
- Recipes (`recipes/*.ts`) drive the UI. The app has **no `data-testid` attributes**, so they use role/text selectors — run `academy:doctor` after any UI label change.
- Media is published to the public `academy-media` bucket in the **production** project; screenshots also feed the public docs via the generated `content/screenshots.generated.ts`.

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
