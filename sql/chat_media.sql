-- Archivos multimedia en los chats (fotos, videos y documentos) + borrado real de mensajes.
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

-- Columnas del adjunto en cada mensaje.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type text;   -- 'image' | 'video' | 'file'
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_mime text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_size bigint;

-- Un mensaje con solo adjunto no lleva texto.
ALTER TABLE public.messages ALTER COLUMN message DROP NOT NULL;

-- Bucket PRIVADO: solo los participantes del chat pueden ver sus archivos (con URLs firmadas).
-- Estructura: chat-media/{chat_id}/{archivo}
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat media participants read'
  ) THEN
    CREATE POLICY "chat media participants read" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] IN (
          SELECT chat_id::text FROM public.chat_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat media participants insert'
  ) THEN
    CREATE POLICY "chat media participants insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] IN (
          SELECT chat_id::text FROM public.chat_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Borrar: participantes del chat (para eliminar un mensaje propio o el chat completo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat media participants delete'
  ) THEN
    CREATE POLICY "chat media participants delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] IN (
          SELECT chat_id::text FROM public.chat_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Actualizar la vista previa del chat al borrar un mensaje.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'update via participants'
  ) THEN
    CREATE POLICY "update via participants" ON public.chats
      FOR UPDATE USING (
        id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

-- Tiempo real (INSERT y DELETE) para que los mensajes nuevos y borrados se reflejen al instante.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END$$;

-- End of script
