-- ==========================================
-- OPTIMIZACIÓN RLS: Tablas secundarias más usadas
-- ==========================================
-- Optimiza políticas RLS en chat, notifications, userlevel, etc.

-- ==========================================
-- TABLA: chat_messages (17 políticas)
-- ==========================================

DROP POLICY IF EXISTS "Users can view their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users_view_own_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users_send_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users_update_own_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete their sent messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users_can_view_own_messages" ON public.chat_messages;

-- Política consolidada de SELECT
CREATE POLICY "users_can_view_own_messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) IN (sender_id, receiver_id)
  );

-- Política consolidada de INSERT
DROP POLICY IF EXISTS "users_can_send_messages" ON public.chat_messages;
CREATE POLICY "users_can_send_messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = sender_id);

-- Política consolidada de UPDATE
DROP POLICY IF EXISTS "users_can_update_messages" ON public.chat_messages;
CREATE POLICY "users_can_update_messages" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) IN (sender_id, receiver_id)
  )
  WITH CHECK (
    (select auth.uid()) IN (sender_id, receiver_id)
  );

-- Política consolidada de DELETE
DROP POLICY IF EXISTS "users_can_delete_own_messages" ON public.chat_messages;
CREATE POLICY "users_can_delete_own_messages" ON public.chat_messages
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = sender_id);

-- ==========================================
-- TABLA: chat_typing_status (8 políticas)
-- ==========================================

DROP POLICY IF EXISTS "Users can view typing status directed to them" ON public.chat_typing_status;
DROP POLICY IF EXISTS "Users can insert their typing status" ON public.chat_typing_status;
DROP POLICY IF EXISTS "Users can update their typing status" ON public.chat_typing_status;
DROP POLICY IF EXISTS "Users can delete their typing status" ON public.chat_typing_status;
DROP POLICY IF EXISTS "users_manage_own_typing" ON public.chat_typing_status;

-- Política consolidada
DROP POLICY IF EXISTS "users_manage_typing_status" ON public.chat_typing_status;
CREATE POLICY "users_manage_typing_status" ON public.chat_typing_status
  FOR ALL TO authenticated
  USING (
    (select auth.uid()) IN (user_id, typing_to_id)
  )
  WITH CHECK (
    (select auth.uid()) = user_id
  );

-- ==========================================
-- TABLA: chat_hidden_conversations (9 políticas)
-- ==========================================

DROP POLICY IF EXISTS "Users can view their own hidden conversations" ON public.chat_hidden_conversations;
DROP POLICY IF EXISTS "Users can hide conversations for themselves" ON public.chat_hidden_conversations;
DROP POLICY IF EXISTS "Users can manage their hidden conversations" ON public.chat_hidden_conversations;
DROP POLICY IF EXISTS "Users can unhide their own conversations" ON public.chat_hidden_conversations;
DROP POLICY IF EXISTS "users_manage_own_hidden_convs" ON public.chat_hidden_conversations;

-- Política consolidada
DROP POLICY IF EXISTS "users_manage_hidden_conversations" ON public.chat_hidden_conversations;
CREATE POLICY "users_manage_hidden_conversations" ON public.chat_hidden_conversations
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ==========================================
-- TABLA: notifications (5 políticas)
-- ==========================================

DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_read_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_owner" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_authenticated" ON public.notifications;

-- SELECT: Solo pueden ver sus propias notificaciones
DROP POLICY IF EXISTS "users_select_notifications" ON public.notifications;
CREATE POLICY "users_select_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT: Cualquier usuario autenticado puede crear notificaciones
DROP POLICY IF EXISTS "users_insert_notifications" ON public.notifications;
CREATE POLICY "users_insert_notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: Solo el dueño puede actualizarlas
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ==========================================
-- TABLA: notification_reads (6 políticas)
-- ==========================================

DROP POLICY IF EXISTS "notification_reads_select_own" ON public.notification_reads;
DROP POLICY IF EXISTS "notification_reads_insert_own" ON public.notification_reads;
DROP POLICY IF EXISTS "notification_reads_delete_own" ON public.notification_reads;
DROP POLICY IF EXISTS "users_manage_own_reads" ON public.notification_reads;

-- Política consolidada
DROP POLICY IF EXISTS "users_manage_notification_reads" ON public.notification_reads;
CREATE POLICY "users_manage_notification_reads" ON public.notification_reads
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ==========================================
-- TABLA: userlevel (7 políticas)
-- ==========================================

DROP POLICY IF EXISTS "userlevel_read_own" ON public.userlevel;
DROP POLICY IF EXISTS "Users can view own userlevel" ON public.userlevel;
DROP POLICY IF EXISTS "Admins can view all userlevels" ON public.userlevel;
DROP POLICY IF EXISTS "Users can update own userlevel" ON public.userlevel;
DROP POLICY IF EXISTS "admins_insert_userlevel" ON public.userlevel;
DROP POLICY IF EXISTS "admins_delete_userlevel" ON public.userlevel;

-- SELECT: Usuario puede ver su propio userlevel O admin puede ver todos
DROP POLICY IF EXISTS "userlevel_select" ON public.userlevel;
CREATE POLICY "userlevel_select" ON public.userlevel
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM public.administrators
      WHERE administrators.user_id = (select auth.uid())
    )
  );

-- UPDATE: Solo el propio usuario puede actualizar su userlevel
DROP POLICY IF EXISTS "userlevel_update_own" ON public.userlevel;
CREATE POLICY "userlevel_update_own" ON public.userlevel
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- INSERT/DELETE: Solo admins
DROP POLICY IF EXISTS "admins_manage_userlevel" ON public.userlevel;
CREATE POLICY "admins_manage_userlevel" ON public.userlevel
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE administrators.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE administrators.user_id = (select auth.uid())
    )
  );

-- ==========================================
-- TABLA: product_alternatives (6 políticas)
-- ==========================================

DROP POLICY IF EXISTS "Administrators can view all alternatives" ON public.product_alternatives;
DROP POLICY IF EXISTS "Clients can view their alternatives" ON public.product_alternatives;
DROP POLICY IF EXISTS "Employees can view all alternatives" ON public.product_alternatives;
DROP POLICY IF EXISTS "Clients can update their alternatives" ON public.product_alternatives;
DROP POLICY IF EXISTS "Employees can create alternatives" ON public.product_alternatives;

-- SELECT consolidado
DROP POLICY IF EXISTS "users_select_alternatives" ON public.product_alternatives;
CREATE POLICY "users_select_alternatives" ON public.product_alternatives
  FOR SELECT TO authenticated
  USING (
    -- Cliente ve sus propias alternativas
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = product_alternatives.order_id)
    OR
    -- Empleados y admins ven todas
    EXISTS (
      SELECT 1 FROM public.userlevel 
      WHERE id = (select auth.uid()) 
      AND user_level IN ('China', 'Vzla', 'Admin')
    )
  );

-- INSERT: Solo empleados
DROP POLICY IF EXISTS "employees_insert_alternatives" ON public.product_alternatives;
CREATE POLICY "employees_insert_alternatives" ON public.product_alternatives
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.userlevel 
      WHERE id = (select auth.uid()) 
      AND user_level IN ('China', 'Vzla', 'Admin')
    )
  );

-- UPDATE: Cliente puede actualizar sus alternativas
DROP POLICY IF EXISTS "clients_update_alternatives" ON public.product_alternatives;
CREATE POLICY "clients_update_alternatives" ON public.product_alternatives
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = product_alternatives.order_id)
  )
  WITH CHECK (
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = product_alternatives.order_id)
  );

-- ==========================================
-- TABLA: order_reviews (7 políticas)
-- ==========================================

DROP POLICY IF EXISTS "Admins can view all reviews" ON public.order_reviews;
DROP POLICY IF EXISTS "Clients can view their own reviews" ON public.order_reviews;
DROP POLICY IF EXISTS "Employees can view all reviews" ON public.order_reviews;
DROP POLICY IF EXISTS "Clients can create reviews for their own orders" ON public.order_reviews;
DROP POLICY IF EXISTS "Admins can update any review" ON public.order_reviews;
DROP POLICY IF EXISTS "Clients can update their own reviews" ON public.order_reviews;
DROP POLICY IF EXISTS "Only admins can delete reviews" ON public.order_reviews;

-- SELECT consolidado
DROP POLICY IF EXISTS "users_select_reviews" ON public.order_reviews;
CREATE POLICY "users_select_reviews" ON public.order_reviews
  FOR SELECT TO authenticated
  USING (
    -- Cliente ve sus propias reviews
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = order_reviews.order_id)
    OR
    -- Empleados y admins ven todas
    EXISTS (
      SELECT 1 FROM public.userlevel 
      WHERE id = (select auth.uid()) 
      AND user_level IN ('China', 'Vzla', 'Admin')
    )
  );

-- INSERT: Solo clientes para sus pedidos
DROP POLICY IF EXISTS "clients_insert_reviews" ON public.order_reviews;
CREATE POLICY "clients_insert_reviews" ON public.order_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = order_reviews.order_id)
  );

-- UPDATE: Cliente actualiza sus reviews O admin actualiza cualquiera
DROP POLICY IF EXISTS "users_update_reviews" ON public.order_reviews;
CREATE POLICY "users_update_reviews" ON public.order_reviews
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = order_reviews.order_id)
    OR EXISTS (
      SELECT 1 FROM public.administrators WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select auth.uid()) = (SELECT client_id FROM public.orders WHERE orders.id = order_reviews.order_id)
    OR EXISTS (
      SELECT 1 FROM public.administrators WHERE user_id = (select auth.uid())
    )
  );

-- DELETE: Solo admins
DROP POLICY IF EXISTS "admins_delete_reviews" ON public.order_reviews;
CREATE POLICY "admins_delete_reviews" ON public.order_reviews
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators WHERE user_id = (select auth.uid())
    )
  );

-- ==========================================
-- TABLA: exchange_rates (1 política + duplicados)
-- ==========================================

DROP POLICY IF EXISTS "Allow service role write access on exchange_rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Allow public read access on exchange_rates" ON public.exchange_rates;

-- SELECT: Público (anon + authenticated)
DROP POLICY IF EXISTS "public_read_exchange_rates" ON public.exchange_rates;
CREATE POLICY "public_read_exchange_rates" ON public.exchange_rates
  FOR SELECT
  USING (true);

-- ==========================================
-- TABLA: business_config (2 políticas)
-- ==========================================

DROP POLICY IF EXISTS "Admins can insert business_config" ON public.business_config;
DROP POLICY IF EXISTS "Admins can update business_config" ON public.business_config;

DROP POLICY IF EXISTS "admins_manage_business_config" ON public.business_config;
CREATE POLICY "admins_manage_business_config" ON public.business_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administrators WHERE user_id = (select auth.uid())
    )
  );

-- ==========================================
-- COMENTARIOS
-- ==========================================

COMMENT ON POLICY "users_can_view_own_messages" ON public.chat_messages IS 
  'Optimizado: consolidó 2 políticas SELECT, usa (select auth.uid())';

COMMENT ON POLICY "users_manage_hidden_conversations" ON public.chat_hidden_conversations IS 
  'Optimizado: consolidó 5 políticas redundantes';

COMMENT ON SCHEMA public IS 
  'RLS Optimizado: orders + 10 tablas secundarias con (select auth.uid()) y políticas consolidadas';
