-- Add missing columns to whatsapp_messages for Twilio conversations
-- Supports both inbound (patient replies) and outbound messages

-- Add missing columns
ALTER TABLE whatsapp_messages 
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_content_type TEXT,
  ADD COLUMN IF NOT EXISTS original_message_sid TEXT,
  ADD COLUMN IF NOT EXISTS template_sid TEXT,
  ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_sid TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_wa_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_staff ON whatsapp_messages(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_unread ON whatsapp_messages(direction, read_at) 
  WHERE direction = 'inbound' AND read_at IS NULL;

-- Notification for incoming WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who to notify
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Related message
  message_id UUID NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_notifications_user ON whatsapp_notifications(user_id);
CREATE INDEX idx_wa_notifications_unread ON whatsapp_notifications(user_id, read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON whatsapp_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON whatsapp_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on notifications"
  ON whatsapp_notifications FOR ALL
  TO service_role
  USING (true);
