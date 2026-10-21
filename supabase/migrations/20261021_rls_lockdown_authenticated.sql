-- ============================================================================
-- SECURITY LOCKDOWN: deny anonymous + non-staff authenticated access
-- ============================================================================
-- Same class of vulnerability as confirmed on the Maison TOA project
-- (2026-10-10): this project is even more exposed — the `anon` role could read
-- patients/appointments/invoices/emails with NO account at all, and any
-- self-registered authenticated account reads everything.
--
-- After this migration:
--   * `authenticated` can only touch tables when the account has a row in
--     public.users with a role other than 'patient' (i.e. clinic staff).
--     Patient-app accounts authenticate via the OTP API (service role) and
--     never query tables directly — they are denied by design.
--   * `anon` gets NOTHING — all public intake/consultation/booking flows now
--     go through /api/public/* routes using the service role.
--   * The service_role key (all /api routes) bypasses RLS — unchanged.
--
-- RUN IN: Supabase Dashboard -> SQL Editor for project chjswljpjxjcsbiresnb
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper: is the current auth user a staff account?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND coalesce(role, '') <> 'patient'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Drop every existing RLS policy in the public schema
-- ---------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Enable RLS on every public table + staff-only policy
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format(
      'CREATE POLICY staff_all ON public.%I FOR ALL TO authenticated
       USING (public.is_staff_user())
       WITH CHECK (public.is_staff_user())',
      t.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. users table: every authenticated user can read/update/insert OWN row
-- ---------------------------------------------------------------------------
CREATE POLICY users_self_select ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY users_self_insert ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Views must run as the invoker (otherwise they bypass RLS entirely)
-- ---------------------------------------------------------------------------
DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.viewname);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'security_invoker not supported on this Postgres version — review views manually';
END $$;

-- Deny anonymous EXECUTE on all public functions (RPC data leak prevention).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', f.proname, f.args);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Storage: staff only (intake photo upload is proxied via /api/public/intake)
-- ---------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY staff_storage_all ON storage.objects
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());
