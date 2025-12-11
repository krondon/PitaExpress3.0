-- Crear tabla para logs de salud de APIs
CREATE TABLE IF NOT EXISTS api_health_logs (
  id BIGSERIAL PRIMARY KEY,
  api_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  response_time_ms INTEGER,
  error_message TEXT,
  rate_obtained NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por API y fecha
CREATE INDEX IF NOT EXISTS idx_api_health_logs_api_name ON api_health_logs(api_name);
CREATE INDEX IF NOT EXISTS idx_api_health_logs_created_at ON api_health_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_health_logs_api_name_created_at ON api_health_logs(api_name, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE api_health_logs IS 'Registra los intentos de conexión a APIs externas de tasas de cambio';
COMMENT ON COLUMN api_health_logs.api_name IS 'Nombre de la API (dollarvzla.com, pydolarvenezuela, exchangerate-api)';
COMMENT ON COLUMN api_health_logs.status IS 'Estado del intento: success o failed';
COMMENT ON COLUMN api_health_logs.response_time_ms IS 'Tiempo de respuesta en milisegundos';
COMMENT ON COLUMN api_health_logs.error_message IS 'Mensaje de error si el intento falló';
COMMENT ON COLUMN api_health_logs.rate_obtained IS 'Tasa de cambio obtenida si el intento fue exitoso';

