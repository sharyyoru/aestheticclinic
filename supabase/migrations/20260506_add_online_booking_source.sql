-- Add 'online_booking' to the appointments source check constraint

-- Drop the existing constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_source_check;

-- Add the new constraint with online_booking included
ALTER TABLE appointments ADD CONSTRAINT appointments_source_check 
  CHECK (source IN ('manual', 'ai', 'online_booking'));
