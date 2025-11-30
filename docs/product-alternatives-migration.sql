-- Migration: Product Alternatives Feature
-- Permite a China proponer alternativas cuando no encuentran el producto exacto

-- Crear tabla para almacenar alternativas de productos
CREATE TABLE IF NOT EXISTS product_alternatives (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  alternative_product_name TEXT NOT NULL,
  alternative_description TEXT,
  alternative_image_url TEXT,
  alternative_price NUMERIC(10, 2),
  proposed_by_china_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  client_response_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_product_alternatives_order_id ON product_alternatives(order_id);
CREATE INDEX IF NOT EXISTS idx_product_alternatives_status ON product_alternatives(status);
CREATE INDEX IF NOT EXISTS idx_product_alternatives_created_at ON product_alternatives(created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_product_alternatives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER trigger_update_product_alternatives_updated_at
  BEFORE UPDATE ON product_alternatives
  FOR EACH ROW
  EXECUTE FUNCTION update_product_alternatives_updated_at();

-- Políticas RLS (Row Level Security)
ALTER TABLE product_alternatives ENABLE ROW LEVEL SECURITY;

-- Política: Empleados pueden crear alternativas
CREATE POLICY "Employees can create alternatives"
  ON product_alternatives
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid()
    )
  );

-- Política: Empleados pueden ver todas las alternativas
CREATE POLICY "Employees can view all alternatives"
  ON product_alternatives
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid()
    )
  );

-- Política: Clientes pueden ver solo sus alternativas
CREATE POLICY "Clients can view their alternatives"
  ON product_alternatives
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN clients c ON c.user_id = o.client_id
      WHERE o.id = product_alternatives.order_id
        AND c.user_id = auth.uid()
    )
  );

-- Política: Clientes pueden actualizar (aceptar/rechazar) sus alternativas
CREATE POLICY "Clients can update their alternatives"
  ON product_alternatives
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN clients c ON c.user_id = o.client_id
      WHERE o.id = product_alternatives.order_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN clients c ON c.user_id = o.client_id
      WHERE o.id = product_alternatives.order_id
        AND c.user_id = auth.uid()
    )
  );

-- Política: Administradores pueden ver todas las alternativas
CREATE POLICY "Administrators can view all alternatives"
  ON product_alternatives
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM administrators 
      WHERE user_id = auth.uid()
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE product_alternatives IS 'Almacena alternativas de productos propuestas por China cuando no encuentran el producto exacto solicitado';
COMMENT ON COLUMN product_alternatives.order_id IS 'ID del pedido original';
COMMENT ON COLUMN product_alternatives.alternative_product_name IS 'Nombre del producto alternativo propuesto';
COMMENT ON COLUMN product_alternatives.alternative_description IS 'Descripción detallada de la alternativa y por qué se propone';
COMMENT ON COLUMN product_alternatives.alternative_image_url IS 'URL de la imagen del producto alternativo';
COMMENT ON COLUMN product_alternatives.alternative_price IS 'Precio propuesto para la alternativa';
COMMENT ON COLUMN product_alternatives.proposed_by_china_id IS 'ID del empleado de China que propuso la alternativa';
COMMENT ON COLUMN product_alternatives.status IS 'Estado: pending (pendiente), accepted (aceptada), rejected (rechazada)';
COMMENT ON COLUMN product_alternatives.client_response_notes IS 'Notas o comentarios del cliente al aceptar/rechazar';
