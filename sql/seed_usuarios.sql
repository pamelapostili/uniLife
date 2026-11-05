-- Crea (o actualiza) usuarios con contraseña "unilife123" para poder iniciar sesión con email.
-- Ejecutar en Supabase → SQL Editor.
-- Si el correo ya existe (p. ej. entró con Google), solo se le asigna la contraseña y se confirma el email.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  correos text[] := ARRAY[
    '2311080494@alumno.utpuebla.edu.mx',
    '2311081826@alumno.utpuebla.edu.mx',
    '2321082888@alumno.utpuebla.edu.mx',
    '2321082989@alumno.utpuebla.edu.mx',
    'alejandrorch85@gmail.com',
    'allen019zpuck@gmail.com',
    'elanbibiano@gmail.com',
    'jjrockg@hotmail.com',
    'jjrockrg@gmail.com',
    'mleyrivcan@gmail.com',
    'pamelabchb@gmail.com',
    'yareth.nava153@gmail.com'
  ];
  correo text;
  uid uuid;
  pass text := crypt('unilife123', gen_salt('bf'));
BEGIN
  FOREACH correo IN ARRAY correos LOOP
    SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(correo);

    IF uid IS NULL THEN
      uid := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', correo, pass,
        now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb,
        now(), now(),
        '', '', '', ''
      );

      RAISE NOTICE 'Creado: %', correo;
    ELSE
      UPDATE auth.users
         SET encrypted_password = pass,
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       WHERE id = uid;

      RAISE NOTICE 'Actualizado: %', correo;
    END IF;

    -- Identidad "email" necesaria para signInWithPassword
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = uid AND provider = 'email') THEN
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', correo, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;

    -- Perfil en public.profiles
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
      uid,
      split_part(correo, '@', 1),
      'https://api.dicebear.com/6.x/initials/svg?seed=' || split_part(correo, '@', 1)
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
