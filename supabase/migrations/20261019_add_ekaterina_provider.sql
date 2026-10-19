-- Dr. Ekaterina Iosipoi needs a providers row so invoices can render the
-- treating doctor. The generate-pdf route looks up providers by the invoice's
-- doctor_user_id, so the provider id must equal the matching users.id.
DO $$
DECLARE
  ekaterina_user_id uuid;
BEGIN
  SELECT id INTO ekaterina_user_id
  FROM public.users
  WHERE lower(trim(full_name)) = 'ekaterina iosipoi'
  LIMIT 1;

  IF ekaterina_user_id IS NULL THEN
    RAISE NOTICE 'Ekaterina Iosipoi user not found; no provider row created.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = ekaterina_user_id) THEN
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
      ekaterina_user_id,
      'Dr. Ekaterina Iosipoi',
      'Aesthetic medicine',
      (SELECT email FROM public.users WHERE id = ekaterina_user_id),
      NULL,
      'doctor',
      'Madame',
      'Docteur',
      true
    );
    RAISE NOTICE 'Created provider row for Ekaterina Iosipoi (id: %)', ekaterina_user_id;
  ELSE
    RAISE NOTICE 'Provider row for Ekaterina Iosipoi already exists.';
  END IF;
END $$;
