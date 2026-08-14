# Clinic CRM Incident Remediation Action Plan

**Incident:** Production database saturation and application-wide timeouts  
**Incident date:** 2026-08-14  
**Last updated:** 2026-08-14  
**Scope:** Supabase, Vercel application, WhatsApp processing, notification polling, and document storage

## Objectives

1. Restore and maintain reliable authentication and CRM page loading.
2. Prevent background traffic from saturating the Supabase Micro instance.
3. Reduce expensive database and Storage queries.
4. Add monitoring that detects recurrence before it becomes an outage.

## Priority 0 — Immediate Stabilization

### 1. Confirm production deployment contains all incident fixes

**Status:** Required verification  
**Commits:**

- `267afeee` — Batch WhatsApp queue enrichment and correct `deals.title` lookup.
- `78ee7ab6` — Reduce and coordinate global notification polling.
- `dc8a5051` — Replace full legacy document bucket scans with indexed mappings.

**Actions:**

- Confirm Vercel production is deployed from `main` at or after commit `dc8a5051`.
- Verify no failed or canceled deployment exists after these commits.
- Open the deployed application in a fresh browser session.

**Success criteria:**

- Production reports commit `dc8a5051` or later.
- Login completes normally.
- Deals and patient document pages load without `504` responses.

### 2. Restore Supabase health if it remains unhealthy

**Status:** Conditional immediate action

**Actions:**

- Check Supabase project health and current resource usage.
- If the project is still unhealthy after the fixes are deployed, restart the database from **Project Settings → General → Restart database**.
- Allow several minutes for Auth, PostgREST, Storage, and Realtime to reconnect.

**Success criteria:**

- Project status returns to **Healthy**.
- Auth token requests no longer remain pending.
- PostgreSQL connection usage returns to a stable baseline.

### 3. Validate the incident fixes in production

**Status:** Required

**Actions:**

- Sign in and sign out using a test staff account.
- Load Deals, Patients, Tasks, Notifications, Appointments, and Invoices.
- Open patient documents for patients with and without legacy documents.
- Confirm the WhatsApp badge displays a count.
- Confirm queued WhatsApp messages continue to send.

**Success criteria:**

- No functional regression is found.
- `deals.name` errors stop completely.
- Patient documents remain accessible.
- WhatsApp sending remains operational.

## Priority 1 — Prevent Recurrence

### 4. Monitor error and traffic rates after deployment

**Status:** Required for the first 24–48 hours

Track:

- PostgreSQL `42703` errors
- PostgreSQL `57014` statement timeouts
- API `504` responses
- Requests per endpoint
- Database RAM, CPU, disk I/O, and connection utilization
- Auth request latency and errors
- Storage `search` call volume and execution time

**Success criteria:**

- No new `deals.name` errors.
- Statement timeouts and `504` responses return to near zero.
- Total request volume drops materially from the incident baseline.
- Database RAM and connections retain operating headroom.

### 5. Verify legacy document mapping coverage

**Status:** Mapping deployed; audit required

The mapping migration created 11,657 mappings for 11,601 patients. Legacy folders that could not be matched were not deleted, but they will not appear through the optimized endpoint until mapped.

**Actions:**

- Identify legacy folders without a mapping.
- Review unmatched folders that correspond to active patients.
- Add approved mappings manually or improve the offline mapping process.
- Do not restore runtime full-bucket scanning as a fallback.

**Success criteria:**

- All legacy folders required by active patients are mapped.
- No patient document request scans the root `patient-docs` bucket.

### 6. Add indexes for notification and queue filters

**Status:** Recommended after query-plan verification

Evaluate and add missing composite or partial indexes for:

- `whatsapp_queue(sender_user_id, status, created_at)`
- `tasks(assigned_user_id, assigned_read_at)`
- `deal_notifications(user_id, read_at, created_at)`
- `email_reply_notifications(user_id, read_at, created_at)`
- `patient_note_mentions(mentioned_user_id, read_at)`
- `task_comment_mentions(mentioned_user_id, read_at)`
- `marketing_campaigns(created_by, completed_at, notification_read_at)`

**Actions:**

- Capture `EXPLAIN (ANALYZE, BUFFERS)` for representative queries.
- Add only indexes supported by the query plans.
- Apply indexes through reviewed Supabase migrations.
- Recheck the Supabase performance advisor afterward.

**Success criteria:**

- Notification count queries use indexes.
- Query latency remains stable as tables grow.
- No unnecessary duplicate indexes are introduced.

## Priority 2 — Reduce Background Load Further

### 7. Consolidate global notification counts

**Status:** Recommended

**Actions:**

- Create one lightweight API endpoint or database function that returns all badge counts.
- Replace independent task, email, campaign, deal, mention, and WhatsApp count requests.
- Keep detailed notification data loading on demand when a user opens a panel.

**Success criteria:**

- One scheduled request updates all global badges.
- Detailed rows are not loaded merely to calculate counts.

### 8. Coordinate polling across browser tabs

**Status:** Recommended

**Actions:**

- Use `BroadcastChannel` or Web Locks so only one visible tab performs polling.
- Broadcast updated counts to other tabs.
- Retain the existing visibility and overlap protections.

**Success criteria:**

- Multiple open tabs for one user produce one polling stream.

### 9. Add timeout, backoff, and jitter to background requests

**Status:** Recommended

**Actions:**

- Abort background requests after a defined timeout, such as 10 seconds.
- Apply exponential backoff after consecutive failures.
- Add random jitter so clients do not retry simultaneously.
- Reset the backoff after a successful request or visibility change.

**Success criteria:**

- Failed background requests do not remain pending indefinitely.
- Request volume decreases automatically during a Supabase incident.

### 10. Evaluate Supabase Realtime for notification invalidation

**Status:** Optional architectural improvement

**Actions:**

- Subscribe to relevant notification inserts and status changes.
- Use events to invalidate or refresh counts.
- Retain a slow fallback poll for missed events or disconnected clients.

**Success criteria:**

- Badge updates remain timely with substantially fewer scheduled queries.

## Priority 3 — Optimize Remaining Expensive Queries

### 11. Move Deals pagination and summary calculations server-side

**Status:** Recommended

**Actions:**

- Fetch only the active page of deals.
- Apply search, filters, sorting, and date ranges in the database.
- Calculate totals through a dedicated aggregate query or database function.
- Avoid loading the entire deal history into the browser.

**Success criteria:**

- Deals page query size and latency do not grow linearly with total deal count.

### 12. Optimize invoice and invoice-line queries

**Status:** Recommended

**Actions:**

- Identify unbounded invoice and line-item requests.
- Add pagination and narrower field selection.
- Avoid downloading all invoice line items for list views.
- Verify indexes for invoice status, archive state, patient, and date filters.

**Success criteria:**

- Invoice queries no longer appear among the highest timeout sources.

### 13. Optimize last-contact aggregation

**Status:** Recommended

**Actions:**

- Avoid loading all email, task, call, note, and WhatsApp rows for every patient on Deals.
- Consider a materialized summary table updated when contact events occur.
- Alternatively, create a database function that returns only the latest event per patient.

**Success criteria:**

- Deals last-contact loading performs bounded indexed queries.

### 14. Review all remaining Storage listing operations

**Status:** Recommended

**Actions:**

- Audit `parse-pdfs`, recovery, merge, financial, and patient app storage listings.
- Ensure interactive application paths are scoped by patient or known folder.
- Restrict full-bucket scans to explicit administrative jobs.
- Paginate administrative scans and prevent concurrent runs.

**Success criteria:**

- No ordinary page load performs a full storage bucket scan.

## Priority 4 — Capacity, Monitoring, and Operations

### 15. Evaluate a Supabase compute upgrade

**Status:** Capacity decision required

**Actions:**

- Observe normal post-fix CPU, RAM, connections, and disk I/O for at least 24 hours.
- Upgrade from Micro if normal traffic still approaches resource limits.
- Change Auth connection allocation from an absolute value to a percentage before or during resizing, as recommended by the Supabase performance advisor.

**Success criteria:**

- Production retains sufficient headroom during peak usage and background jobs.

### 16. Add automated alerts and operational dashboards

**Status:** Recommended

Alert on:

- Project health becoming unhealthy
- RAM or CPU remaining above the agreed threshold
- Connection pool saturation
- Repeated statement timeouts
- Elevated `5xx` and `504` rates
- Sudden endpoint traffic increases
- Repeated SQL error fingerprints

**Success criteria:**

- The team receives an alert before users report a widespread outage.

### 17. Establish incident response and rollback procedures

**Status:** Recommended

**Actions:**

- Document how to restart the database safely.
- Document how to identify a problematic Vercel deployment.
- Define rollback steps for application and database migrations.
- Define incident ownership and communication channels.
- Retain a tested production smoke-test checklist.

**Success criteria:**

- An on-call team member can diagnose, mitigate, and communicate a similar incident using a documented process.

## Completed Work

| Item | Status | Reference |
|---|---|---|
| Batch WhatsApp queue enrichment | Completed and pushed | `267afeee` |
| Correct invalid `deals.name` lookup | Completed and pushed | `267afeee` |
| Five-minute visibility-aware polling | Completed and pushed | `78ee7ab6` |
| Prevent overlapping notification polls | Completed and pushed | `78ee7ab6` |
| WhatsApp count-only endpoint | Completed and pushed | `78ee7ab6` |
| Durable legacy document folder mapping | Completed and pushed | `dc8a5051` |
| Remove runtime root-bucket document scans | Completed and pushed | `dc8a5051` |
| Production Supabase mapping migration | Applied | `legacy_patient_doc_folder_map` |

## Recommended Execution Order

1. Confirm production deployment and smoke-test critical workflows.
2. Restore Supabase health if still unhealthy.
3. Monitor errors and resources for 24–48 hours.
4. Audit unmatched legacy document folders.
5. Verify and add critical indexes.
6. Consolidate notification counts and coordinate polling across tabs.
7. Add background-request timeout, backoff, and jitter.
8. Optimize Deals, invoices, last-contact aggregation, and remaining Storage scans.
9. Decide whether to upgrade Supabase compute.
10. Add alerts and formalize incident operations.
