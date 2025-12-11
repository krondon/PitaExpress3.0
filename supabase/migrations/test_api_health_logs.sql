-- Script de prueba para verificar que las políticas RLS funcionan
-- Ejecuta esto en el SQL Editor de Supabase para probar manualmente

-- 1. Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'api_health_logs';

-- 2. Ver las políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'api_health_logs';

-- 3. Intentar insertar un log de prueba como service_role (simular backend)
-- NOTA: Esto solo funciona si ejecutas desde el backend con service_role
-- Para probar manualmente, desactiva RLS temporalmente o usa el rol postgres

-- 4. Verificar si hay datos
SELECT COUNT(*) as total_logs FROM api_health_logs;

-- 5. Ver los últimos logs
SELECT * FROM api_health_logs ORDER BY created_at DESC LIMIT 10;

