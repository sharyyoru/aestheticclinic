# Deal Notifications Guide

This guide explains how to trigger entries to the `deal_notifications` table.

## Overview

Deal notifications are automatically created when:
1. A deal's stage changes
2. A new deal is created
3. A deal is assigned to a user
4. A deal is updated

## Helper Functions

The `src/lib/dealNotifications.ts` module provides helper functions:

### 1. `notifyDealStageChange()`
Triggers when a deal moves from one stage to another (or is created).

```typescript
import { notifyDealStageChange } from "@/lib/dealNotifications";

await notifyDealStageChange(
  dealId,           // string
  patientId,        // string
  fromStageId,      // string | null (null = new deal)
  toStageId,        // string
  changedByUserId,  // string | null (optional)
  changedByName,    // string | null (optional)
);
```

### 2. `notifyDealAssigned()`
Triggers when a deal is assigned to a new owner.

```typescript
import { notifyDealAssigned } from "@/lib/dealNotifications";

await notifyDealAssigned(
  dealId,
  patientId,
  newOwnerId,       // User ID to notify
  changedByUserId,
  changedByName,
);
```

### 3. `notifyDealUpdated()`
Triggers for general deal updates.

```typescript
import { notifyDealUpdated } from "@/lib/dealNotifications";

await notifyDealUpdated(
  dealId,
  patientId,
  changedByUserId,
  changedByName,
);
```

### 4. `createDealNotification()` (Advanced)
Low-level function for custom notification scenarios.

```typescript
import { createDealNotification } from "@/lib/dealNotifications";

await createDealNotification({
  dealId: "...",
  patientId: "...",
  notificationType: 'stage_changed', // or 'deal_created', 'deal_assigned', 'deal_updated'
  oldStageId: "...",
  newStageId: "...",
  oldStageName: "...",
  newStageName: "...",
  changedByUserId: "...",
  changedByName: "...",
  notifyUserIds: ["user1", "user2"], // Optional: specific users to notify
});
```

## Automatic Triggers (Already Implemented)

### 1. Workflow API Route
**File:** `src/app/api/workflows/deal-stage-changed/route.ts`

This route is called whenever a deal stage changes and automatically creates notifications:

```typescript
// Already integrated - notifications are created automatically
POST /api/workflows/deal-stage-changed
{
  "dealId": "...",
  "patientId": "...",
  "fromStageId": "..." | null,
  "toStageId": "...",
  "pipeline": "..."
}
```

### 2. Frontend Deal Updates
**Files:**
- `src/app/patients/[id]/PatientActivityCard.tsx` (lines 1918-1943)
- `src/app/deals/page.tsx` (lines 477-492)
- `src/app/api/leads/import/route.ts` (lines 392-400)

These already call the workflow API, which triggers notifications.

## Manual Integration Examples

### Example 1: Add to Deal Update API
If you create a new API route for updating deals:

```typescript
// src/app/api/deals/update/route.ts
import { notifyDealStageChange, notifyDealAssigned } from "@/lib/dealNotifications";

export async function POST(request: Request) {
  const { dealId, stageId, ownerId } = await request.json();
  
  // Get current deal
  const { data: currentDeal } = await supabaseAdmin
    .from("deals")
    .select("stage_id, owner_id, patient_id")
    .eq("id", dealId)
    .single();
  
  // Update deal
  await supabaseAdmin
    .from("deals")
    .update({ stage_id: stageId, owner_id: ownerId })
    .eq("id", dealId);
  
  // Notify stage change
  if (currentDeal.stage_id !== stageId) {
    await notifyDealStageChange(
      dealId,
      currentDeal.patient_id,
      currentDeal.stage_id,
      stageId,
      userId, // from auth session
      userName,
    );
  }
  
  // Notify assignment change
  if (currentDeal.owner_id !== ownerId) {
    await notifyDealAssigned(
      dealId,
      currentDeal.patient_id,
      ownerId,
      userId,
      userName,
    );
  }
  
  return NextResponse.json({ success: true });
}
```

### Example 2: Database Trigger (Alternative)
You can also create a PostgreSQL trigger in `schema.sql`:

```sql
-- Function to create deal notification on stage change
CREATE OR REPLACE FUNCTION notify_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if stage changed
  IF (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id) OR TG_OP = 'INSERT' THEN
    -- Get stage names
    INSERT INTO deal_notifications (
      user_id,
      deal_id,
      patient_id,
      notification_type,
      old_stage_id,
      new_stage_id,
      old_stage_name,
      new_stage_name
    )
    SELECT 
      NEW.owner_id,
      NEW.id,
      NEW.patient_id,
      CASE WHEN TG_OP = 'INSERT' THEN 'deal_created' ELSE 'stage_changed' END,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
      NEW.stage_id,
      CASE WHEN TG_OP = 'UPDATE' THEN (SELECT name FROM deal_stages WHERE id = OLD.stage_id) ELSE NULL END,
      (SELECT name FROM deal_stages WHERE id = NEW.stage_id)
    WHERE NEW.owner_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS deal_stage_change_notification ON deals;
CREATE TRIGGER deal_stage_change_notification
  AFTER INSERT OR UPDATE OF stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_deal_stage_change();
```

## Notification Behavior

- **Who gets notified:** By default, the deal owner receives notifications
- **Self-notifications:** Users don't receive notifications for their own changes
- **Custom recipients:** Use `notifyUserIds` parameter to notify specific users
- **Read status:** Notifications start as unread (`read_at = null`)
- **Auto-refresh:** Frontend polls every 30 seconds for new notifications

## Testing

To test notifications:

1. **Create a deal:**
   ```typescript
   // Will trigger 'deal_created' notification
   await supabaseClient.from("deals").insert({
     patient_id: "...",
     stage_id: "...",
     owner_id: "...",
     title: "Test Deal"
   });
   ```

2. **Change deal stage:**
   ```typescript
   // Will trigger 'stage_changed' notification
   await supabaseClient.from("deals")
     .update({ stage_id: newStageId })
     .eq("id", dealId);
   
   // Then call the workflow API
   await fetch("/api/workflows/deal-stage-changed", {
     method: "POST",
     body: JSON.stringify({
       dealId,
       patientId,
       fromStageId: oldStageId,
       toStageId: newStageId,
       pipeline: "..."
     })
   });
   ```

3. **Check notifications:**
   ```sql
   SELECT * FROM deal_notifications 
   WHERE user_id = 'your-user-id' 
   ORDER BY created_at DESC;
   ```

## Troubleshooting

- **No notifications appearing:** Check that the deal has an `owner_id` set
- **Notifications not refreshing:** Check browser console for context errors
- **Duplicate notifications:** Ensure you're not calling notification functions multiple times
- **Missing stage names:** Verify `deal_stages` table has the referenced stage IDs
