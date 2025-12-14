-- FIX: Allow all authenticated users to see Admin userlevels
-- Problem: Chat page needs to find 'Admin' user to start conversation, but RLS hid them from non-admins.

DROP POLICY IF EXISTS "userlevel_select" ON public.userlevel;

CREATE POLICY "userlevel_select" ON public.userlevel
  FOR SELECT TO authenticated
  USING (
    -- Usuario ve su propio nivel
    (select auth.uid()) = id
    OR 
    -- Admins ven todo
    public.is_admin()
    OR
    -- CUALQUIER usuario autenticado puede ver a los Admins (necesario para chat/soporte)
    user_level = 'Admin'
  );

COMMENT ON POLICY "userlevel_select" ON public.userlevel IS 
  'Permite ver propio nivel, admins ven todo, y todos ven a los admins (para chat).';
