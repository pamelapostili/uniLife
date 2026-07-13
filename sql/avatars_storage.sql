-- Bucket público para fotos de perfil + políticas de acceso.
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lectura pública de cualquier avatar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars public read'
  ) THEN
    CREATE POLICY "avatars public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END$$;

-- Cada usuario solo puede subir/actualizar archivos dentro de su propia carpeta: avatars/{user_id}/...
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars owner insert'
  ) THEN
    CREATE POLICY "avatars owner insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars owner update'
  ) THEN
    CREATE POLICY "avatars owner update" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END$$;

-- End of script
