# Aesthetic Clinic CRM - Windsurf Skill Pack

A comprehensive skill pack containing patterns, rules, and workflows for building clinic management systems with Next.js, Supabase, and modern web technologies.

## Author

**Wilson** (megaplan)

## Project

Aesthetic Clinic CRM - A full-featured clinic management system for Swiss aesthetic medical practices.

## Installation

Copy the `.windsurf/` directory to your project root:

```bash
cp -r .windsurf/ /path/to/your/project/
```

## Contents

### Rules (8 files)

| Rule | Description |
|------|-------------|
| `01-project-architecture.md` | Next.js 15 + React 19 + Supabase stack overview |
| `02-supabase-patterns.md` | Database queries, RLS, auth, real-time subscriptions |
| `03-demo-mode-system.md` | Complete data isolation for demo environments |
| `04-api-development.md` | API route patterns, error handling, caching |
| `05-swiss-medical-billing.md` | SUMEX, TarDoc, Swiss QR Bill integration |
| `06-document-editing.md` | DOCX templates, PDF generation, storage |
| `07-ai-integration.md` | Google Gemini AI for email generation |
| `08-communication.md` | Email (Mailgun), WhatsApp (Twilio), notifications |

### Workflows (5 files)

| Workflow | Description |
|----------|-------------|
| `add-new-feature.md` | Standard feature development process |
| `add-database-table.md` | Create tables with RLS and demo support |
| `create-api-endpoint.md` | API route creation checklist |
| `deploy-to-production.md` | Vercel + Railway deployment guide |
| `debug-supabase-rls.md` | RLS troubleshooting steps |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, TypeScript, Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Google Gemini
- **Email**: Mailgun
- **SMS/WhatsApp**: Twilio
- **Payments**: Payrexx, Stripe
- **Deployment**: Vercel, Railway

## Key Patterns

### Demo Mode Isolation

Every data table includes `is_demo` boolean for complete data separation:

```sql
ALTER TABLE table_name ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "Demo isolation" ON table_name
FOR ALL TO authenticated
USING (is_demo = is_current_user_demo());
```

### Two Supabase Clients

```typescript
// Browser-side (respects RLS)
import { supabase } from "@/lib/supabaseClient";

// Server-side (bypasses RLS)
import { supabaseAdmin } from "@/lib/supabaseAdmin";
```

### API Response Pattern

```typescript
// Success
return NextResponse.json(data);
return NextResponse.json(data, { status: 201 });

// Error
return NextResponse.json({ error: "Message" }, { status: 400 });
```

## Usage Tips

1. **Read rules before coding** - They contain copy-pastable patterns
2. **Follow workflows step-by-step** - Especially for database changes
3. **Use `// turbo` annotation** - For auto-runnable commands in workflows
4. **Check demo support** - Always add `is_demo` to new tables

## Related Documentation

Project-specific docs in repository root:

- `CLAUDE.md` - AI assistant instructions
- `README_DEMO_MODE.md` - Demo mode details
- `INVOICE_SYSTEM_SUMMARY.md` - Payment system
- `WHATSAPP_SETUP.md` - WhatsApp integration

## Version

- **Skill Pack Version**: 1.0
- **Created**: August 2026
- **Last Updated**: August 2026

---

*Built with Windsurf + Cascade AI*
