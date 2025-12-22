-- Create user_availability table for managing doctor/user working hours
CREATE TABLE IF NOT EXISTS user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '19:00',
  is_available BOOLEAN NOT NULL DEFAULT true,
  location TEXT DEFAULT 'Champel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week, location)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_availability_day ON user_availability(day_of_week);

-- Enable RLS
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read all availability
CREATE POLICY "Allow authenticated users to read availability"
  ON user_availability FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow users to manage their own availability
CREATE POLICY "Allow users to manage own availability"
  ON user_availability FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for service role to manage all
CREATE POLICY "Allow service role full access"
  ON user_availability FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE user_availability IS 'Stores working hours and availability for each user per day of week';
COMMENT ON COLUMN user_availability.day_of_week IS '0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
