-- Vlada's Supabase Auth account has now been created. This migration ensures
-- her public.users profile is correctly named/roled and creates the provider
-- + scheduling rows needed for the agenda and invoice PDFs.
DO $$
DECLARE
  vladislava_user_id uuid;
BEGIN
  SELECT id INTO vladislava_user_id
  FROM public.users
  WHERE lower(trim(email)) = 'vlada@aesthetics-ge.ch'
  LIMIT 1;

  IF vladislava_user_id IS NULL THEN
    RAISE NOTICE 'Vlada user not found; aborting.';
    RETURN;
  END IF;

  -- Ensure the user record has a proper full name and doctor role.
  UPDATE public.users
  SET
    full_name = COALESCE(NULLIF(trim(full_name), ''), 'Vladislava Gladysheva'),
    role = 'doctor',
    designation = COALESCE(NULLIF(trim(designation), ''), 'Doctor')
  WHERE id = vladislava_user_id;

  RAISE NOTICE 'Updated user profile for Vlada (id: %)', vladislava_user_id;

  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = vladislava_user_id) THEN
    INSERT INTO public.providers (
      id,
      name,
      specialty,
      email,
      phone,
      role,
      salutation,
      title,
      is_active
    )
    VALUES (
      vladislava_user_id,
      'Dr. Vladislava Gladysheva',
      'Aesthetic medicine',
      'vlada@aesthetics-ge.ch',
      NULL,
      'doctor',
      'Madame',
      'Docteur',
      true
    );
    RAISE NOTICE 'Created provider row for Vladislava Gladysheva (id: %)', vladislava_user_id;
  ELSE
    RAISE NOTICE 'Provider row for Vladislava Gladysheva already exists.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctor_scheduling_settings WHERE provider_id = vladislava_user_id) THEN
    INSERT INTO public.doctor_scheduling_settings (provider_id, time_interval_minutes, default_duration_minutes)
    VALUES (vladislava_user_id, 15, 15);
    RAISE NOTICE 'Created scheduling settings for Vladislava Gladysheva.';
  END IF;
END $$;

-- Repair legacy online bookings / appointments that name Vladislava/Vlada as the doctor.
UPDATE public.appointments a
SET doctor_user_id = u.id
FROM public.users u
WHERE a.doctor_user_id IS NULL
  AND lower(trim(u.email)) = 'vlada@aesthetics-ge.ch'
  AND lower(trim((regexp_match(a.reason, '\[Doctor:\s*([^]]+)\]', 'i'))[1])) IN ('vladislava', 'vlada', 'gladysheva')
  AND (SELECT count(*) FROM public.users candidate
       WHERE lower(trim(candidate.email)) = 'vlada@aesthetics-ge.ch') = 1;
