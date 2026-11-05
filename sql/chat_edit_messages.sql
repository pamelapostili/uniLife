-- Permite editar mensajes propios en los chats (y marcarlos como "editado").
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Solo quien envió el mensaje puede editarlo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'update own messages'
  ) THEN
    CREATE POLICY "update own messages" ON public.messages
      FOR UPDATE USING (sender_id = auth.uid())
      WITH CHECK (sender_id = auth.uid());
  END IF;
END$$;

-- End of script
