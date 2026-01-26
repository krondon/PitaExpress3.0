-- Corregir DEFINITIVAMENTE la política RLS para el rol Pagos
-- Permite ver TODO el historial de pedidos que hayan pasado por validación (state >= 3)
-- Así no desaparecen cuando la logística avanza a China (6, 7, 8) o Venezuela (9+)

DROP POLICY IF EXISTS "pagos_select_orders" ON public.orders;

CREATE POLICY "pagos_select_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.userlevel
      WHERE id = auth.uid() AND user_level = 'Pagos'
    )
    AND
    (
      state >= 3 OR state = -1 -- Ver cualquier pedido desde "Cotizado" en adelante, y rechazados
    )
  );

-- Mantener la capacidad de actualizar solo en estados relevantes para su trabajo
DROP POLICY IF EXISTS "pagos_update_order_state" ON public.orders;

CREATE POLICY "pagos_update_order_state" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.userlevel
      WHERE id = auth.uid() AND user_level = 'Pagos'
    )
    AND
    state >= 3 -- Pueden intentar editar, pero el CHECK limita qué pueden hacer
  )
  WITH CHECK (
    -- Permite aprobar (4->5), rechazar (...->-1), o quizás revertir si es necesario
    -- Ojo: Idealmente restringir a no tocar estados muy avanzados, 
    -- pero para "deshacer" a veces se necesita flexibilidad.
    state IN (3, 4, 5, -1) 
  );
