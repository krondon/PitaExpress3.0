-- ===================================================================
-- SCRIPT DE LIMPIEZA Y CORRECCIÓN DE USUARIOS DUPLICADOS
-- Este script limpia usuarios duplicados en múltiples tablas de roles
-- ===================================================================

-- PASO 1: Ver el estado actual (antes de limpiar)
SELECT '========== ANTES DE LIMPIAR ==========' as estado;

SELECT 
  'auth.users' as tabla, COUNT(*) as cantidad
FROM auth.users
UNION ALL
SELECT 'employees', COUNT(*) FROM public.employees
UNION ALL
SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL
SELECT 'administrators', COUNT(*) FROM public.administrators
UNION ALL
SELECT 'userlevel', COUNT(*) FROM public.userlevel;

-- PASO 2: Limpiar COMPLETAMENTE todas las tablas
SELECT '========== LIMPIANDO ==========' as estado;

-- Orden importante: primero las tablas dependientes
DELETE FROM public.userlevel;
DELETE FROM public.employees;
DELETE FROM public.clients;
DELETE FROM public.administrators;
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- PASO 3: Verificar que todo esté limpio
SELECT '========== DESPUÉS DE LIMPIAR ==========' as estado;

SELECT 
  'auth.users' as tabla, COUNT(*) as cantidad
FROM auth.users
UNION ALL
SELECT 'employees', COUNT(*) FROM public.employees
UNION ALL
SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL
SELECT 'administrators', COUNT(*) FROM public.administrators
UNION ALL
SELECT 'userlevel', COUNT(*) FROM public.userlevel;

-- Resultado esperado: todos en 0

SELECT '========== ¡LISTO! Ahora ejecuta seed-remote.sql ==========' as siguiente_paso;
