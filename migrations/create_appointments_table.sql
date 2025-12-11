-- Create appointments table for storing appointment details
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title VARCHAR(255),
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location VARCHAR(255),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_deal_id ON appointments(deal_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Create scheduled_emails table for reminder emails
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('patient', 'user')),
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for scheduled emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_for ON scheduled_emails(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_appointment_id ON scheduled_emails(appointment_id);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Create policies for appointments
CREATE POLICY "Users can view all appointments" ON appointments
  FOR SELECT USING (true);

CREATE POLICY "Users can insert appointments" ON appointments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update appointments" ON appointments
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete appointments" ON appointments
  FOR DELETE USING (true);

-- Create policies for scheduled_emails
CREATE POLICY "Users can view all scheduled_emails" ON scheduled_emails
  FOR SELECT USING (true);

CREATE POLICY "Users can insert scheduled_emails" ON scheduled_emails
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update scheduled_emails" ON scheduled_emails
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete scheduled_emails" ON scheduled_emails
  FOR DELETE USING (true);
