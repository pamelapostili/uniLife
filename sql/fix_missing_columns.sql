-- Fix missing columns referenced by the app and add indexes safely.
-- Run in Supabase SQL editor (Project → SQL Editor → New query)

-- Ensure pgcrypto (for gen_random_uuid) exists
create extension if not exists "pgcrypto";

-- Add inserted_at to messages if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'inserted_at'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN inserted_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added column messages.inserted_at';
  END IF;
END$$;

-- Add inserted_at to profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'inserted_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN inserted_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added column profiles.inserted_at';
  END IF;
END$$;

-- Add updated_at to profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added column profiles.updated_at';
  END IF;
END$$;

-- Add updated_at to chats if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chats' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.chats ADD COLUMN updated_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added column chats.updated_at';
  END IF;
END$$;

-- Add inserted_at to posts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'inserted_at'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN inserted_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added column posts.inserted_at';
  END IF;
END$$;

-- Create indexes if not exist (safe)
CREATE INDEX IF NOT EXISTS idx_messages_chat ON public.messages (chat_id, inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles (lower(coalesce(full_name,'')) text_pattern_ops);

-- Report final state (query columns)
-- SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('profiles','messages','chats','posts');

-- End of fix script
