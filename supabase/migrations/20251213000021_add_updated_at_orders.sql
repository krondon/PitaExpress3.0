-- ==========================================
-- FIX: Agregar columna updated_at faltante en orders
-- ==========================================
-- El error 400 en admin/pedidos se debe a que el frontend solicita 'updated_at'
-- pero la columna no existe en la tabla 'orders'.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Crear trigger para mantener updated_at actualizado automáticamente
CREATE OR REPLACE TRIGGER trg_set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.orders.updated_at IS 'Fecha de última actualización. Agregada para corregir error 400 en admin.';
