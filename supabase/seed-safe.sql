-- Script de seed SEGURO para base de datos remota
-- Limpia COMPLETAMENTE antes de insertar nuevos usuarios

-- 1. Limpiar tabla userlevel primero (dependiente)
TRUNCATE TABLE public.userlevel CASCADE;

-- 2. Limpiar usuarios de auth
TRUNCATE TABLE auth.users CASCADE;

-- 3. Limpiar identities
TRUNCATE TABLE auth.identities CASCADE;

-- 4. Crear usuarios funcionales con contraseña 12345678
DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  china_id uuid := gen_random_uuid();
  vzla_id uuid := gen_random_uuid();
  pagos_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
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
  RAISE NOTICE '   • admin@gmail.com (Admin)';
  RAISE NOTICE '   • china@gmail.com (China)';
  RAISE NOTICE '   • venezuela@gmail.com (Vzla)';
  RAISE NOTICE '   • validador@gmail.com (Pagos)';
  RAISE NOTICE '   • cliente@gmail.com (Client)';
  RAISE NOTICE '🔑 Contraseña para todos: 12345678';

END $$;
