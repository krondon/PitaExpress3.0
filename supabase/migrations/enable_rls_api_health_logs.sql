-- Habilitar Row Level Security en la tabla api_health_logs
ALTER TABLE api_health_logs ENABLE ROW LEVEL SECURITY;

-- Política 1: Permitir que el servicio (service_role) pueda insertar logs
-- Esto es necesario para que el backend pueda registrar los intentos de API
CREATE POLICY "Service role can insert api health logs"
ON api_health_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Política 2: Permitir que el servicio (service_role) pueda leer todos los logs
-- Esto es necesario para que el endpoint /api/exchange-rate/health pueda obtener estadísticas
CREATE POLICY "Service role can read api health logs"
ON api_health_logs
FOR SELECT
TO service_role
USING (true);

-- Política 3: Permitir que usuarios autenticados con rol de administrador puedan leer logs
-- Esto permite que los admins vean el monitoreo en el frontend
CREATE POLICY "Admins can read api health logs"
ON api_health_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM administrators
    WHERE administrators.user_id = auth.uid()
  )
);

-- Nota: No creamos políticas para UPDATE o DELETE porque los logs son históricos
-- y no deben ser modificados o eliminados por usuarios

