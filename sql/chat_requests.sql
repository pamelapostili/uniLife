-- Solicitudes de mensaje + membresía de chats compartidos.
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

create extension if not exists "pgcrypto";

-- Membresía real de cada chat (permite que un chat sea compartido por 2+ usuarios).
create table if not exists public.chat_participants (
  chat_id uuid references public.chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (chat_id, user_id)
);

-- Solicitud de mensaje entre dos usuarios. También es la fuente de "Notificaciones".
create table if not exists public.message_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  chat_id uuid references public.chats(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sender_id, receiver_id)
);

alter table public.chat_participants enable row level security;
alter table public.message_requests enable row level security;

-- chat_participants: puedo ver/insertar mi propia membresía, o la de un chat al que ya pertenezco.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'select own chat_participants'
  ) THEN
    CREATE POLICY "select own chat_participants" ON public.chat_participants
      FOR SELECT USING (
        user_id = auth.uid()
        OR chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'insert own chat_participants'
  ) THEN
    CREATE POLICY "insert own chat_participants" ON public.chat_participants
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

-- message_requests: veo/actualizo lo que envié o recibí; solo puedo insertar como sender.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_requests' AND policyname = 'select own requests'
  ) THEN
    CREATE POLICY "select own requests" ON public.message_requests
      FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_requests' AND policyname = 'insert requests'
  ) THEN
    CREATE POLICY "insert requests" ON public.message_requests
      FOR INSERT WITH CHECK (sender_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_requests' AND policyname = 'update own requests'
  ) THEN
    CREATE POLICY "update own requests" ON public.message_requests
      FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());
  END IF;
END$$;

-- chats: políticas adicionales (permisivas, se suman a las que ya existan) para el modelo
-- de chat compartido vía chat_participants. Necesarias porque la política vieja
-- probablemente solo permite user_id = auth.uid(), lo cual bloquearía al otro participante.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'select via participants'
  ) THEN
    CREATE POLICY "select via participants" ON public.chats
      FOR SELECT USING (
        id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
      );
  END IF;
END$$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'insert authenticated'
  ) THEN
    CREATE POLICY "insert authenticated" ON public.chats
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END$$;

-- profiles: asegurar que cualquier usuario autenticado pueda buscar a otros usuarios por nombre.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'select all profiles'
  ) THEN
    CREATE POLICY "select all profiles" ON public.profiles
      FOR SELECT USING (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_receiver ON public.message_requests (receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_message_requests_sender ON public.message_requests (sender_id, status);

-- End of script
