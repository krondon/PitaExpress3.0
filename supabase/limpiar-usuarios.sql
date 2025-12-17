-- ⚠️ SCRIPT DE LIMPIEZA COMPLETA DE USUARIOS
-- Este script eliminará TODOS los usuarios y reiniciará desde cero
-- Úsalo SOLO si quieres empezar de nuevo

-- PASO 1: Limpiar tablas de roles (en orden correcto para evitar FK) -- Primero limpiamos userlevel (puede tener FK de otras tablas)
DELETE FROM public.userlevel;

-- Limpiar tablas de roles
DELETE FROM public.employees;
DELETE FROM public.clients;
DELETE FROM public.administrators;

-- PASO 2: Limpiar identities de auth
DELETE FROM auth.identities;

-- PASO 3: Limpiar usuarios de auth
DELETE FROM auth.users;

-- PASO 4: Verificar que todo está limpio
SELECT 'employees' as tabla, COUNT(*) FROM public.employees
UNION ALL
SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL
SELECT 'administrators', COUNT(*) FROM public.administrators
UNION ALL
SELECT 'userlevel', COUNT(*) FROM public.userlevel
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users
UNION ALL
SELECT 'auth.identities', COUNT(*) FROM auth.identities;

-- Resultado esperado: todos con COUNT = 0
