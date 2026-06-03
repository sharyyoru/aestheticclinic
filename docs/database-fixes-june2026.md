# Database Fixes Required - June 2026

## Issues from Yulia's Feedback

### Issue 3: Clean Up Inactive Staff/Providers

**Problem:** The providers list contains staff who are no longer at the clinic and duplicate entries.

**Staff to Remove (per Yulia):**
- Aileen's duplicate entries (if any)
- Amélie Klein
- Ekaterina
- Any other inactive staff

**SQL to find duplicates:**
```sql
-- Find duplicate providers by name
SELECT name, COUNT(*) as count
FROM providers
GROUP BY name
HAVING COUNT(*) > 1;

-- List all providers
SELECT id, name, email, created_at
FROM providers
ORDER BY name;
```

**SQL to soft-delete inactive providers:**
```sql
-- Add is_active column if not exists
ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Mark inactive providers
UPDATE providers 
SET is_active = false 
WHERE name ILIKE '%Amélie Klein%' 
   OR name ILIKE '%Ekaterina%';
```

### Issue 5: Unlink Calendars from Gstaad

**Problem:** When creating appointments for Aileen, Amélie Klein, or Ekaterina, duplicate appointments are automatically created in the Gstaad calendar.

**Root Cause:** There may be a trigger, linked calendar configuration, or appointment sync that's duplicating entries.

**Investigation Steps:**
1. Check for database triggers on appointments table:
```sql
SELECT * FROM pg_trigger WHERE tgrelid = 'appointments'::regclass;
```

2. Check for any linked_calendars or calendar_sync tables:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%calendar%' OR table_name LIKE '%sync%';
```

3. Check doctor_calendars table for linked configurations:
```sql
SELECT * FROM doctor_calendars 
WHERE name ILIKE '%Aileen%' 
   OR name ILIKE '%Amélie%' 
   OR name ILIKE '%Ekaterina%'
   OR name ILIKE '%Gstaad%';
```

**Fix:** Remove any calendar linking between these staff and Gstaad location.

---

## Code Changes Made (Already Applied)

### Issue 1: Cancellation Email ✅
- Verified: `sendAppointmentCancellationEmail` correctly says "cancelled" not "change"
- The email subject is "Appointment cancelled - {date}"
- Code path is correct at line 3046-3048 in appointments/page.tsx

### Issue 2: Appointment Reminders ✅
Created new cron job: `/api/cron/appointment-reminders`
- Sends WhatsApp (priority) + email 1 day before appointment
- Sends WhatsApp (priority) + email 1 hour after booking

**Required DB columns:**
```sql
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_confirmation_sent_at TIMESTAMPTZ;
```

**Vercel Cron Configuration:**
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/appointment-reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Issue 4: "No Patient" → "PAUSE" ✅
- Changed UI dropdown from "Meeting" to "PAUSE (blocks booking)"
- Changed display text from "Meeting" to "PAUSE"
- Fixed booking APIs to NOT skip no_patient appointments (they now BLOCK booking)

---

## Testing Checklist

- [ ] Create a PAUSE slot and verify it blocks online booking
- [ ] Cancel an appointment and verify email says "cancelled"
- [ ] Book an appointment and verify WhatsApp + email reminder is sent 1 hour later
- [ ] Verify 1-day-before reminder is sent via WhatsApp + email
- [ ] Remove duplicate providers from database
- [ ] Fix Gstaad calendar linking issue
