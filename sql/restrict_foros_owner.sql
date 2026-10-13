-- Solo el autor de un foro puede editarlo o eliminarlo. Antes de esto,
-- cualquier usuario autenticado podía editar/eliminar publicaciones ajenas
-- porque no había políticas RLS que lo impidieran a nivel de base de datos
-- (ocultar los botones en la app no alcanza: cualquiera podía llamar a la
-- API de Supabase directamente).
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

alter table public.foros enable row level security;

-- Cualquiera puede ver los foros (comportamiento que ya tenía la app).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'foros' AND policyname = 'select all foros'
  ) THEN
    CREATE POLICY "select all foros" ON public.foros FOR SELECT USING (true);
  END IF;
END$$;

-- Cualquier usuario autenticado puede crear un foro nuevo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'foros' AND policyname = 'insert own foro'
  ) THEN
    CREATE POLICY "insert own foro" ON public.foros FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END$$;

-- Solo el autor (user_id) puede editar o eliminar su propio foro.
-- Los foros antiguos sin user_id quedan protegidos por defecto (nadie
-- puede editarlos/eliminarlos desde la app, ya que no hay dueño registrado).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'foros' AND policyname = 'update own foro'
  ) THEN
    CREATE POLICY "update own foro" ON public.foros FOR UPDATE USING (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'foros' AND policyname = 'delete own foro'
  ) THEN
    CREATE POLICY "delete own foro" ON public.foros FOR DELETE USING (user_id = auth.uid());
  END IF;
END$$;

-- Habilita el tiempo real (INSERT/UPDATE/DELETE) para que foros, respuestas,
-- chats y mensajes se actualicen solos en todos los dispositivos conectados.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['foros', 'respuestas', 'messages', 'chats'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END$$;

-- End of script
