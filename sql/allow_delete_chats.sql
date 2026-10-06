-- Permite que un participante de un chat lo elimine por completo
-- (mensajes + membresía + el chat), no solo ocultarlo.
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

alter table public.messages enable row level security;

-- Ver/insertar/eliminar mensajes: solo si soy participante de ese chat.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'select own chat messages'
  ) THEN
    CREATE POLICY "select own chat messages" ON public.messages
      FOR SELECT USING (
        chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'insert own chat messages'
  ) THEN
    CREATE POLICY "insert own chat messages" ON public.messages
      FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'delete own chat messages'
  ) THEN
    CREATE POLICY "delete own chat messages" ON public.messages
      FOR DELETE USING (
        chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

-- Eliminar mi propia fila de membresía de un chat.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'delete own participant row'
  ) THEN
    CREATE POLICY "delete own participant row" ON public.chat_participants
      FOR DELETE USING (
        chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

-- Eliminar el chat en sí, si soy uno de sus participantes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'delete via participants'
  ) THEN
    CREATE POLICY "delete via participants" ON public.chats
      FOR DELETE USING (
        id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

-- End of script
