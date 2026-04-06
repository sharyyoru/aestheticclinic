import { supabaseAdmin } from "./supabaseAdmin";

type CreateDealNotificationParams = {
  dealId: string;
  patientId: string;
  notificationType: 'stage_changed' | 'deal_created' | 'deal_assigned' | 'deal_updated';
  oldStageId?: string | null;
  newStageId?: string | null;
  oldStageName?: string | null;
  newStageName?: string | null;
  changedByUserId?: string | null;
  changedByName?: string | null;
  notifyUserIds?: string[];
};

export async function createDealNotification(params: CreateDealNotificationParams) {
  const {
    dealId,
    patientId,
    notificationType,
    oldStageId = null,
    newStageId = null,
    oldStageName = null,
    newStageName = null,
    changedByUserId = null,
    changedByName = null,
    notifyUserIds = [],
  } = params;

  try {
    // If no specific users to notify, get the deal owner
    let userIdsToNotify = notifyUserIds;
    
    if (userIdsToNotify.length === 0) {
      const { data: deal } = await supabaseAdmin
        .from("deals")
        .select("owner_id")
        .eq("id", dealId)
        .single();
      
      if (deal?.owner_id) {
        userIdsToNotify = [deal.owner_id];
      }
    }

    // Don't notify the user who made the change
    if (changedByUserId) {
      userIdsToNotify = userIdsToNotify.filter(id => id !== changedByUserId);
    }

    // If no users to notify, return early
    if (userIdsToNotify.length === 0) {
      return { success: true, notificationsCreated: 0 };
    }

    // Create notification for each user
    const notifications = userIdsToNotify.map(userId => ({
      user_id: userId,
      deal_id: dealId,
      patient_id: patientId,
      notification_type: notificationType,
      old_stage_id: oldStageId,
      new_stage_id: newStageId,
      old_stage_name: oldStageName,
      new_stage_name: newStageName,
      changed_by_user_id: changedByUserId,
      changed_by_name: changedByName,
    }));

    const { error } = await supabaseAdmin
      .from("deal_notifications")
      .insert(notifications);

    if (error) {
      console.error("Error creating deal notifications:", error);
      return { success: false, error: error.message };
    }

    return { success: true, notificationsCreated: notifications.length };
  } catch (err) {
    console.error("Error in createDealNotification:", err);
    return { success: false, error: String(err) };
  }
}

export async function notifyDealStageChange(
  dealId: string,
  patientId: string,
  fromStageId: string | null,
  toStageId: string,
  changedByUserId?: string | null,
  changedByName?: string | null,
) {
  // Fetch stage names
  const stageIds = [fromStageId, toStageId].filter(Boolean) as string[];
  const { data: stages } = await supabaseAdmin
    .from("deal_stages")
    .select("id, name")
    .in("id", stageIds);

  const stagesMap = new Map(stages?.map(s => [s.id, s.name]) || []);
  const fromStageName = fromStageId ? stagesMap.get(fromStageId) || null : null;
  const toStageName = stagesMap.get(toStageId) || null;

  return createDealNotification({
    dealId,
    patientId,
    notificationType: fromStageId ? 'stage_changed' : 'deal_created',
    oldStageId: fromStageId,
    newStageId: toStageId,
    oldStageName: fromStageName,
    newStageName: toStageName,
    changedByUserId,
    changedByName,
  });
}

export async function notifyDealAssigned(
  dealId: string,
  patientId: string,
  newOwnerId: string,
  changedByUserId?: string | null,
  changedByName?: string | null,
) {
  return createDealNotification({
    dealId,
    patientId,
    notificationType: 'deal_assigned',
    changedByUserId,
    changedByName,
    notifyUserIds: [newOwnerId],
  });
}

export async function notifyDealUpdated(
  dealId: string,
  patientId: string,
  changedByUserId?: string | null,
  changedByName?: string | null,
) {
  return createDealNotification({
    dealId,
    patientId,
    notificationType: 'deal_updated',
    changedByUserId,
    changedByName,
  });
}
