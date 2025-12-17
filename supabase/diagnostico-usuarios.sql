-- Script de diagnóstico: Ver todos los usuarios y sus roles actuales
-- Ejecuta esto en el SQL Editor de Supabase para ver qué está pasando

-- 1. Ver TODOS los usuarios en auth.users
SELECT 
  'auth.users' as origen,
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Ver usuarios en cada tabla de roles
SELECT 'employees' as tabla, user_id, name FROM public.employees
UNION ALL
SELECT 'clients' as tabla, user_id, name FROM public.clients
UNION ALL
SELECT 'administrators' as tabla, user_id, name FROM public.administrators
ORDER BY tabla, name;

-- 3. Ver userlevel
SELECT id, user_level FROM public.userlevel ORDER BY user_level;

-- 4. CONTEO por tabla (esto te dirá dónde están los 7)
SELECT 
  'employees' as tabla, COUNT(*) as cantidad FROM public.employees
UNION ALL
SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL
SELECT 'admin istrators', COUNT(*) FROM public.administrators
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users
UNION ALL
SELECT 'userlevel', COUNT(*) FROM public.userlevel;

-- 5. Encontrar usuarios duplicados o huérfanos
-- Usuarios en auth.users pero SIN rol asignado
SELECT 
  u.id,
  u.email,
  u.created_at,
  'Sin rol asignado' as problema
FROM auth.users u
LEFT JOIN public.employees e ON u.id = e.user_id
LEFT JOIN public.clients c ON u.id = c.user_id
LEFT JOIN public.administrators a ON u.id = a.user_id
WHERE e.user_id IS NULL 
  AND c.user_id IS NULL 
  AND a.user_id IS NULL;

-- 6. Usuarios con rol pero SIN userlevel
SELECT DISTINCT
  COALESCE(e.user_id, c.user_id, a.user_id) as user_id,
  COALESCE(e.name, c.name, a.name) as name,
  CASE 
    WHEN e.user_id IS NOT NULL THEN 'employee'
    WHEN c.user_id IS NOT NULL THEN 'client'
    WHEN a.user_id IS NOT NULL THEN 'administrator'
  END as rol_tabla,
  'Sin userlevel' as problema
FROM (
  SELECT user_id, name FROM public.employees
  UNION ALL
  SELECT user_id, name FROM public.clients
  UNION ALL
  SELECT user_id, name FROM public.administrators
) AS todos
LEFT JOIN public.userlevel ul ON todos.user_id = ul.id
WHERE ul.id IS NULL;
