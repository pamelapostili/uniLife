-- Sistema de "seguir" entre usuarios.
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

create table if not exists public.follows (
  follower_id uuid references auth.users(id) on delete cascade,
  followed_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

alter table public.follows enable row level security;

-- Cualquier usuario autenticado puede ver quién sigue a quién (para mostrar
-- contadores/estado de "Siguiendo" en perfiles públicos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'select all follows'
  ) THEN
    CREATE POLICY "select all follows" ON public.follows
      FOR SELECT USING (true);
  END IF;
END$$;

-- Solo puedo crear/borrar mis propias relaciones de "seguir".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'insert own follow'
  ) THEN
    CREATE POLICY "insert own follow" ON public.follows
      FOR INSERT WITH CHECK (follower_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'delete own follow'
  ) THEN
    CREATE POLICY "delete own follow" ON public.follows
      FOR DELETE USING (follower_id = auth.uid());
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.follows (followed_id);

-- End of script
