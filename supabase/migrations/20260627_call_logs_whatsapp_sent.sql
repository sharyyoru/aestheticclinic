-- Track whether a WhatsApp booking link was sent during a call.
--
-- The Retell agent's in-call `send_whatsapp` function is recorded in
-- retell_request_logs (function_name = 'send_whatsapp') keyed by call_id. We
-- denormalise the send time onto call_logs so the patient CRM "Call Logs" tab
-- can show the action and gate booking-conversion attribution on it without
-- needing service-role access to retell_request_logs from the client.

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_call_logs_whatsapp_sent_at ON call_logs(whatsapp_sent_at);
