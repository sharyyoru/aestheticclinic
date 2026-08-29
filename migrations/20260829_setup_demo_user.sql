-- Setup Demo User for demo@aliice.com
-- Run this AFTER creating the user in Supabase Auth Dashboard
--
-- Steps:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Enter: Email: demo@aliice.com, Password: demotest, Auto Confirm: Yes
-- 4. Then run this script

-- Get the auth user ID and insert/update the users table
DO $$
DECLARE
  demo_user_id uuid;
BEGIN
  -- Get the auth user ID
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo@aliice.com';
  
  IF demo_user_id IS NULL THEN
    RAISE NOTICE 'Demo user not found in auth.users. Please create the user first via Supabase Dashboard.';
    RETURN;
  END IF;
  
  -- Insert or update the users table
  INSERT INTO users (id, email, full_name, role, is_demo)
  VALUES (demo_user_id, 'demo@aliice.com', 'Demo User', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET
    is_demo = true,
    role = 'admin',
    full_name = 'Demo User';
    
  RAISE NOTICE 'Demo user setup complete! User ID: %', demo_user_id;
END $$;

-- Verify the setup
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_demo,
  au.email as auth_email
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'demo@aliice.com';

-- Show demo data counts
SELECT 
  'patients' as table_name, count(*) as demo_records FROM patients WHERE is_demo = true
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE is_demo = true
UNION ALL SELECT 'deals', count(*) FROM deals WHERE is_demo = true
UNION ALL SELECT 'workflows', count(*) FROM workflows WHERE is_demo = true
UNION ALL SELECT 'email_templates', count(*) FROM email_templates WHERE is_demo = true
UNION ALL SELECT 'tasks', count(*) FROM tasks WHERE is_demo = true
ORDER BY table_name;
