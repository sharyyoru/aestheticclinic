-- Chat conversations table for logging Aliice chat/call interactions
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retell_chat_id TEXT,
  retell_call_id TEXT,
  conversation_type TEXT NOT NULL CHECK (conversation_type IN ('chat', 'web_call', 'phone_call')),
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'ended')),
  
  -- User identification
  visitor_email TEXT,
  visitor_phone TEXT,
  visitor_name TEXT,
  
  -- Linked patient (if matched or created)
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_match_type TEXT CHECK (patient_match_type IN ('email', 'phone', 'created', 'manual', NULL)),
  
  -- Conversation data
  messages JSONB DEFAULT '[]'::jsonb,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  
  -- Source tracking
  source_url TEXT,
  source_referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_patient_id ON chat_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_visitor_email ON chat_conversations(visitor_email);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_visitor_phone ON chat_conversations(visitor_phone);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_retell_chat_id ON chat_conversations(retell_chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_retell_call_id ON chat_conversations(retell_call_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_type ON chat_conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_started_at ON chat_conversations(started_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER trigger_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_conversations_updated_at();

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON chat_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow insert for anon users (for public embed)
CREATE POLICY "Allow insert for anon" ON chat_conversations
  FOR INSERT TO anon WITH CHECK (true);

-- Allow update for anon users (for updating their own conversations)
CREATE POLICY "Allow update for anon" ON chat_conversations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
