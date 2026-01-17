-- Migration: Enhanced WhatsApp Conversations Tracking
-- Date: 2026-01-17
-- Purpose: Track WhatsApp conversations with proper threading and metadata

-- Add new columns to whatsapp_messages table for better conversation tracking
ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS message_sid TEXT,
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS template_id TEXT,
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster conversation lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_patient_created 
ON whatsapp_messages(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation 
ON whatsapp_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_sid 
ON whatsapp_messages(message_sid);

-- Create whatsapp_templates table for message templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'MARKETING',
  language TEXT NOT NULL DEFAULT 'en',
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  meta_template_id TEXT,
  twilio_content_sid TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for whatsapp_templates
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view templates"
ON whatsapp_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to create templates"
ON whatsapp_templates FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update templates"
ON whatsapp_templates FOR UPDATE
TO authenticated
USING (true);

-- Create whatsapp_conversations table for conversation metadata
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, phone_number)
);

-- RLS policies for whatsapp_conversations
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view conversations"
ON whatsapp_conversations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to create conversations"
ON whatsapp_conversations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update conversations"
ON whatsapp_conversations FOR UPDATE
TO authenticated
USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_patient
ON whatsapp_conversations(patient_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message
ON whatsapp_conversations(last_message_at DESC);

-- Comments
COMMENT ON TABLE whatsapp_templates IS 'WhatsApp message templates for Meta Business API and Twilio';
COMMENT ON TABLE whatsapp_conversations IS 'WhatsApp conversation metadata and tracking';
COMMENT ON COLUMN whatsapp_messages.message_sid IS 'Twilio or Meta message SID/ID';
COMMENT ON COLUMN whatsapp_messages.conversation_id IS 'Groups messages into conversations';
COMMENT ON COLUMN whatsapp_messages.template_id IS 'Reference to template used (if any)';
