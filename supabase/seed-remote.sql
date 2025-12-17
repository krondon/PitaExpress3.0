-- Script de seed IDEMPOTENTE para base de datos remota
-- Puede ejecutarse múltiples veces sin problemas

-- PASO 1: Limpiar COMPLETAMENTE usando DELETE
-- (más confiable que TRUNCATE en algunos casos)

-- Eliminar identities primero (sin foreign key constraints)
DELETE FROM auth.identities WHERE provider = 'email' 
  AND user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN ('admin@gmail.com', 'china@gmail.com', 'venezuela@gmail.com', 'validador@gmail.com', 'cliente@gmail.com')
  );

-- Eliminar de userlevel
DELETE FROM public.userlevel WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('admin@gmail.com', 'china@gmail.com', 'venezuela@gmail.com', 'validador@gmail.com', 'cliente@gmail.com')
);

-- Eliminar usuarios
DELETE FROM auth.users 
WHERE email IN ('admin@gmail.com', 'china@gmail.com', 'venezuela@gmail.com', 'validador@gmail.com', 'cliente@gmail.com');

-- PASO 2: Insertar usuarios con UUIDs fijos (idempotente)
DO $$
DECLARE
  -- UUIDs fijos para que el script sea idempotente
  admin_id uuid := '11111111-1111-1111-1111-111111111111';
  china_id uuid := '22222222-2222-2222-2222-222222222222';
  vzla_id uuid := '33333333-3333-3333-3333-333333333333';
  pagos_id uuid := '44444444-4444-4444-4444-444444444444';
  client_id uuid := '55555555-5555-5555-5555-555555555555';
BEGIN
  -- 1. Crear ADMIN (admin@gmail.com)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    role, aud, confirmation_token, email_change, phone, phone_change,
    email_change_token_new, email_change_token_current, recovery_token, reauthentication_token
  )
  VALUES (
    admin_id, 
    '00000000-0000-0000-0000-000000000000', 
    'admin@gmail.com', 
    crypt('12345678', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Administrador","full_name":"Administrador","phone":""}', 
    now(), now(), 'authenticated', 'authenticated', '', '', NULL, '',
    '', '', '', ''
  );

  INSERT INTO public.userlevel (id, user_level) VALUES (admin_id, 'Admin');

  -- 2. Crear Empleado CHINA (china@gmail.com)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    role, aud, confirmation_token, email_change, phone, phone_change,
    email_change_token_new, email_change_token_current, recovery_token, reauthentication_token
  )
  VALUES (
    china_id, 
    '00000000-0000-0000-0000-000000000000', 
    'china@gmail.com', 
    crypt('12345678', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Empleado China","full_name":"Empleado China","phone":""}', 
    now(), now(), 'authenticated', 'authenticated', '', '', NULL, '',
    '', '', '', ''
  );

  INSERT INTO public.userlevel (id, user_level) VALUES (china_id, 'China');

  -- 3. Crear Empleado VENEZUELA (venezuela@gmail.com)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    role, aud, confirmation_token, email_change, phone, phone_change,
    email_change_token_new, email_change_token_current, recovery_token, reauthentication_token
  )
  VALUES (
    vzla_id, 
    '00000000-0000-0000-0000-000000000000', 
    'venezuela@gmail.com', 
    crypt('12345678', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Empleado Venezuela","full_name":"Empleado Venezuela","phone":""}', 
    now(), now(), 'authenticated', 'authenticated', '', '', NULL, '',
    '', '', '', ''
  );

  INSERT INTO public.userlevel (id, user_level) VALUES (vzla_id, 'Vzla');

  -- 4. Crear Empleado PAGOS / Validador (validador@gmail.com)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    role, aud, confirmation_token, email_change, phone, phone_change,
    email_change_token_new, email_change_token_current, recovery_token, reauthentication_token
  )
  VALUES (
    pagos_id, 
    '00000000-0000-0000-0000-000000000000', 
    'validador@gmail.com', 
    crypt('12345678', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Validador Pagos","full_name":"Validador Pagos","phone":""}', 
    now(), now(), 'authenticated', 'authenticated', '', '', NULL, '',
    '', '', '', ''
  );

  INSERT INTO public.userlevel (id, user_level) VALUES (pagos_id, 'Pagos');

  -- 5. Crear CLIENTE (cliente@gmail.com)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    role, aud, confirmation_token, email_change, phone, phone_change,
    email_change_token_new, email_change_token_current, recovery_token, reauthentication_token
  )
  VALUES (
    client_id, 
    '00000000-0000-0000-0000-000000000000', 
    'cliente@gmail.com', 
    crypt('12345678', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Cliente Prueba","full_name":"Cliente Prueba","phone":""}', 
    now(), now(), 'authenticated', 'authenticated', '', '', NULL, '',
    '', '', '', ''
  );

  INSERT INTO public.userlevel (id, user_level) VALUES (client_id, 'Client');

  -- Insertar identities (requerido para login)
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES 
    (gen_random_uuid(), admin_id, format('{"sub":"%s","email":"admin@gmail.com"}', admin_id)::jsonb, 'email', admin_id::text, now(), now(), now()),
    (gen_random_uuid(), china_id, format('{"sub":"%s","email":"china@gmail.com"}', china_id)::jsonb, 'email', china_id::text, now(), now(), now()),
    (gen_random_uuid(), vzla_id, format('{"sub":"%s","email":"venezuela@gmail.com"}', vzla_id)::jsonb, 'email', vzla_id::text, now(), now(), now()),
    (gen_random_uuid(), pagos_id, format('{"sub":"%s","email":"validador@gmail.com"}', pagos_id)::jsonb, 'email', pagos_id::text, now(), now(), now()),
    (gen_random_uuid(), client_id, format('{"sub":"%s","email":"cliente@gmail.com"}', client_id)::jsonb, 'email', client_id::text, now(), now(), now());

  RAISE NOTICE '✅ Seed completado exitosamente!';
  RAISE NOTICE '👥 Usuarios creados:';
  RAISE NOTICE '   • admin@gmail.com (Admin) - Password: 12345678';
  RAISE NOTICE '   • china@gmail.com (China) - Password: 12345678';
  RAISE NOTICE '   • venezuela@gmail.com (Vzla) - Password: 12345678';
  RAISE NOTICE '   • validador@gmail.com (Pagos) - Password: 12345678';
  RAISE NOTICE '   • cliente@gmail.com (Client) - Password: 12345678';

END $$;
