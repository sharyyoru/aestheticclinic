-- Query to find potentially incorrect appointment dates
-- This helps identify appointments where the date might have been entered incorrectly

-- Find appointments where:
-- 1. Surgery/operation appointments that are scheduled in an unusual month 
-- 2. Appointments created recently but scheduled for a past date
-- 3. Appointments with suspicious date patterns

-- Find operations scheduled in March that might be September errors (month confusion)
SELECT 
    a.id,
    a.start_time,
    a.reason,
    a.location,
    a.status,
    p.first_name || ' ' || p.last_name as patient_name,
    a.created_at,
    EXTRACT(MONTH FROM a.start_time) as scheduled_month,
    'Potential month confusion - check if March should be September' as check_reason
FROM appointments a
JOIN patients p ON a.patient_id = p.id
WHERE 
    (LOWER(a.reason) LIKE '%relevé%' 
     OR LOWER(a.reason) LIKE '%surgery%' 
     OR LOWER(a.reason) LIKE '%operation%'
     OR LOWER(a.reason) LIKE '%chirurgie%')
    AND EXTRACT(MONTH FROM a.start_time) = 3  -- March
    AND a.status != 'cancelled'
ORDER BY a.start_time;

-- Find all future operations to review
SELECT 
    a.id,
    a.start_time AT TIME ZONE 'Europe/Zurich' as swiss_time,
    a.reason,
    a.location,
    a.status,
    p.first_name || ' ' || p.last_name as patient_name,
    a.created_at
FROM appointments a
JOIN patients p ON a.patient_id = p.id
WHERE 
    (LOWER(a.reason) LIKE '%relevé%' 
     OR LOWER(a.reason) LIKE '%surgery%' 
     OR LOWER(a.reason) LIKE '%operation%'
     OR LOWER(a.reason) LIKE '%chirurgie%')
    AND a.start_time > NOW()
    AND a.status != 'cancelled'
ORDER BY a.start_time;

-- To fix a specific appointment (example - update with correct date):
-- UPDATE appointments 
-- SET start_time = '2026-09-15T06:00:00Z'  -- Adjust to correct UTC time for Swiss timezone
-- WHERE id = 'APPOINTMENT_ID_HERE';
