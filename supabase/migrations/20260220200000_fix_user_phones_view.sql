-- ==========================================
-- FIX: user_phones leía auth.users.phone (campo nativo) en vez del teléfono
-- real que se guarda en raw_user_meta_data->>'phone'.
--
-- Postgres no soporta `WITH (security_definer = true)` para Vistas.
-- Por lo tanto, creamos una función SECURITY DEFINER que lee la tabla auth.users
-- y luego una vista pública que usa esa función.
-- ==========================================

DROP VIEW IF EXISTS public.user_phones CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_user_phones() CASCADE;

-- 1. Función SECURITY DEFINER que tiene acceso a auth.users
CREATE OR REPLACE FUNCTION public.get_auth_user_phones()
RETURNS TABLE (
  id uuid,
  phone text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    id,
    COALESCE(
      NULLIF(TRIM(raw_user_meta_data->>'phone'), ''),
      NULLIF(TRIM(phone), '')
    ) AS phone
  FROM auth.users;
$$;

-- 2. La Vista que las APIs / Edge Functions consultarán
CREATE VIEW public.user_phones
AS
SELECT * FROM public.get_auth_user_phones();

-- 3. Permisos
REVOKE ALL ON public.user_phones FROM PUBLIC;
GRANT SELECT ON public.user_phones TO service_role;
GRANT SELECT ON public.user_phones TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_phones() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_user_phones() TO authenticated;

COMMENT ON VIEW public.user_phones IS
  'Vista de teléfonos de usuarios basada en una función SECURITY DEFINER para poder leer auth.users.';
