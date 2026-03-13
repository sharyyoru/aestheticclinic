/**
 * WhatsApp Queue Processor
 * 
 * Polls the Supabase whatsapp_queue table for pending messages
 * and sends them via the appropriate user's WhatsApp session.
 * 
 * Statuses:
 *   pending          – waiting to be sent
 *   sending          – locked for processing (prevent duplicate)
 *   sent             – successfully delivered
 *   session_failed   – user's WhatsApp session is down; auto-retried on reconnect
 *   failed           – permanent delivery failure (bad number, send error after retries)
 */

const { createClient } = require('@supabase/supabase-js');
const { getConnectionStatus, sendMessage, getChatByPhoneNumber, broadcastToUser } = require('./whatsapp-manager');
const { logEvent } = require('./db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL = parseInt(process.env.QUEUE_POLL_INTERVAL) || 10000;
const BATCH_SIZE = 10;

let supabase = null;
let pollTimer = null;
let isProcessing = false;

// Track which users we already notified about session being down (avoid spam)
const sessionDownNotified = new Set();

/**
 * Initialize the Supabase client for queue processing
 */
function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[Queue] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — queue processor disabled');
    return false;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('[Queue] Supabase client initialized');
  return true;
}

/**
 * Start the queue polling loop
 */
function startQueueProcessor() {
  if (!initSupabase()) return;

  console.log(`[Queue] Starting queue processor (polling every ${POLL_INTERVAL}ms)`);
  pollTimer = setInterval(processQueue, POLL_INTERVAL);

  // Run once immediately
  processQueue();
}

/**
 * Stop the queue polling loop
 */
function stopQueueProcessor() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[Queue] Queue processor stopped');
  }
}

/**
 * Main queue processing function — called on each poll interval
 */
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Fetch pending messages that are due (scheduled_at <= now)
    const now = new Date().toISOString();
    const { data: items, error } = await supabase
      .from('whatsapp_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[Queue] Error fetching queue items:', error.message);
      isProcessing = false;
      return;
    }

    if (!items || items.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[Queue] Processing ${items.length} pending message(s)`);

    for (const item of items) {
      await processQueueItem(item);
    }
  } catch (err) {
    console.error('[Queue] Unexpected error in processQueue:', err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Process a single queue item
 */
async function processQueueItem(item) {
  const { id, sender_user_id, to_phone, message_body, retry_count, max_retries } = item;

  // Mark as 'sending' to prevent duplicate processing
  const { error: lockError } = await supabase
    .from('whatsapp_queue')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (lockError) {
    console.error(`[Queue] Failed to lock item ${id}:`, lockError.message);
    return;
  }

  try {
    // Check if the sender's WhatsApp session is connected
    const status = await getConnectionStatus(sender_user_id);

    if (!status || status.status !== 'ready') {
      // Session not connected — mark as session_failed (will be auto-retried on reconnect)
      await supabase
        .from('whatsapp_queue')
        .update({
          status: 'session_failed',
          error_message: `WhatsApp session not connected for user ${sender_user_id}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      console.warn(`[Queue] Session not ready for user ${sender_user_id}, item ${id} — marked as session_failed`);

      // Notify user immediately (once per session-down episode)
      if (!sessionDownNotified.has(sender_user_id)) {
        sessionDownNotified.add(sender_user_id);
        await notifySessionDown(sender_user_id, item);
      }

      return;
    }

    // Resolve phone number to WhatsApp chatId
    const formattedPhone = to_phone.replace(/\D/g, '');
    const chatId = `${formattedPhone}@c.us`;

    // Send the message via the user's WhatsApp session
    await sendMessage(sender_user_id, chatId, message_body);

    // Mark as sent
    await supabase
      .from('whatsapp_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', id);

    console.log(`[Queue] Sent message ${id} to ${to_phone} via user ${sender_user_id}`);
    logEvent(sender_user_id, 'queue_message_sent', { queueId: id, to: to_phone });

    // Also log to workflow_enrollment_steps if enrollment_id is present
    if (item.enrollment_id) {
      await supabase.from('workflow_enrollment_steps').insert({
        enrollment_id: item.enrollment_id,
        step_type: 'action',
        step_action: 'send_whatsapp',
        step_config: { to_phone, sender_user_id: sender_user_id },
        status: 'completed',
        executed_at: new Date().toISOString(),
        result: { queue_id: id, to: to_phone, sent_via: 'whatsapp_web' },
      });
    }

  } catch (err) {
    // This is a SEND error (session is connected but message failed)
    // e.g. invalid number, blocked, network error
    const newRetryCount = retry_count + 1;
    const isFinalFailure = newRetryCount >= max_retries;

    await supabase
      .from('whatsapp_queue')
      .update({
        status: isFinalFailure ? 'failed' : 'pending',
        retry_count: newRetryCount,
        error_message: err.message || 'Unknown send error',
        // Push scheduled_at forward by 1 minute for retry
        scheduled_at: isFinalFailure
          ? item.scheduled_at
          : new Date(Date.now() + 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    console.error(`[Queue] Send error for item ${id} (retry ${newRetryCount}/${max_retries}):`, err.message);
    logEvent(sender_user_id, 'queue_message_failed', { queueId: id, error: err.message });

    if (isFinalFailure) {
      // Notify about permanent send failure
      await notifySendFailed(sender_user_id, item, err.message);

      // Log failed step to workflow enrollment
      if (item.enrollment_id) {
        await supabase.from('workflow_enrollment_steps').insert({
          enrollment_id: item.enrollment_id,
          step_type: 'action',
          step_action: 'send_whatsapp',
          step_config: { to_phone, sender_user_id: sender_user_id },
          status: 'failed',
          executed_at: new Date().toISOString(),
          error_message: err.message || 'Unknown send error',
        });
      }
    }
  }
}

/**
 * Called when a user's WhatsApp session becomes ready.
 * Resets all their session_failed messages back to pending so they get retried.
 */
async function retrySessionFailedMessages(userId) {
  if (!supabase) return;

  try {
    // Clear the "already notified" flag so future disconnects will alert again
    sessionDownNotified.delete(userId);

    const { data, error } = await supabase
      .from('whatsapp_queue')
      .update({
        status: 'pending',
        error_message: null,
        scheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('sender_user_id', userId)
      .eq('status', 'session_failed')
      .select('id');

    if (error) {
      console.error(`[Queue] Error retrying session_failed messages for ${userId}:`, error.message);
      return;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[Queue] User ${userId} reconnected — retrying ${count} session_failed message(s)`);
      logEvent(userId, 'queue_session_retry', { count });

      // Notify user their queued messages are being retried
      broadcastToUser(userId, 'queue_alert', {
        type: 'session_retry',
        title: 'WhatsApp Reconnected',
        message: `${count} queued message(s) are now being sent.`,
      });

      // Trigger immediate processing
      processQueue();
    }
  } catch (err) {
    console.error(`[Queue] Error in retrySessionFailedMessages:`, err.message);
  }
}

/**
 * Notify user that their WhatsApp session is down and queued messages are waiting.
 */
async function notifySessionDown(userId, queueItem) {
  try {
    // Count total session_failed messages for this user
    let waitingCount = 1;
    if (supabase) {
      const { count } = await supabase
        .from('whatsapp_queue')
        .select('*', { count: 'exact', head: true })
        .eq('sender_user_id', userId)
        .eq('status', 'session_failed');
      waitingCount = Math.max(count || 1, 1);
    }

    const message = `Your WhatsApp session is disconnected. ${waitingCount} message(s) are waiting to be sent. Please reconnect by opening WhatsApp in the top menu and scanning the QR code. Messages will be sent automatically once you reconnect.`;

    // Real-time WebSocket notification to the user's browser
    broadcastToUser(userId, 'queue_alert', {
      type: 'session_down',
      title: 'WhatsApp Disconnected — Messages Queued',
      message,
      waitingCount,
      toPhone: queueItem.to_phone,
      patientId: queueItem.patient_id,
      dealId: queueItem.deal_id,
    });

    // Also log the event in SQLite for persistence
    logEvent(userId, 'session_down_notification', {
      toPhone: queueItem.to_phone,
      waitingCount,
      message,
    });

    console.log(`[Queue] Sent session-down alert to user ${userId} (${waitingCount} messages waiting)`);
  } catch (err) {
    console.error(`[Queue] Failed to notify user ${userId}:`, err.message);
  }
}

/**
 * Notify user that a message permanently failed to send (not a session issue).
 */
async function notifySendFailed(userId, queueItem, errorMsg) {
  try {
    const message = `Failed to send WhatsApp message to ${queueItem.to_phone} after ${queueItem.max_retries} attempts: ${errorMsg}`;

    broadcastToUser(userId, 'queue_alert', {
      type: 'send_failed',
      title: 'WhatsApp Message Failed',
      message,
      queueId: queueItem.id,
      toPhone: queueItem.to_phone,
      patientId: queueItem.patient_id,
      dealId: queueItem.deal_id,
      error: errorMsg,
    });

    logEvent(userId, 'queue_send_failed', {
      queueId: queueItem.id,
      toPhone: queueItem.to_phone,
      error: errorMsg,
    });

    console.log(`[Queue] Sent permanent-failure alert to user ${userId} for ${queueItem.to_phone}`);
  } catch (err) {
    console.error(`[Queue] Failed to notify user ${userId}:`, err.message);
  }
}

/**
 * Get queue stats for diagnostics
 */
async function getQueueStats() {
  if (!supabase) return { enabled: false };

  try {
    const { count: pending } = await supabase
      .from('whatsapp_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: sessionFailed } = await supabase
      .from('whatsapp_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'session_failed');

    const { count: failed } = await supabase
      .from('whatsapp_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    const { count: sent } = await supabase
      .from('whatsapp_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    return {
      enabled: true,
      pending: pending || 0,
      session_failed: sessionFailed || 0,
      failed: failed || 0,
      sent: sent || 0,
    };
  } catch (err) {
    return { enabled: true, error: err.message };
  }
}

module.exports = {
  startQueueProcessor,
  stopQueueProcessor,
  processQueue,
  getQueueStats,
  retrySessionFailedMessages,
};
