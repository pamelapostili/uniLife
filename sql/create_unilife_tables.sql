-- Creates basic tables expected by the app.
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

-- 1) profiles: one row per auth user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  bio text,
  interests text[],
  latitude double precision,
  longitude double precision,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) chats: one chat record (e.g. between 2 users or groups)
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean default false,
  created_by uuid references auth.users(id) on delete set null,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- mapping table (chat members)
create table if not exists public.chat_members (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  role text
);

-- 3) messages: messages per chat
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text,
  inserted_at timestamptz default now()
);

-- 4) posts (foros)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid references auth.users(id) on delete set null,
  category text,
  title text,
  description text,
  response_count int default 0,
  likes int default 0,
  avatar_url text,
  inserted_at timestamptz default now()
);

-- Optional: add indexes
create index if not exists idx_profiles_full_name on public.profiles (lower(coalesce(full_name,'')) text_pattern_ops);
create index if not exists idx_messages_chat on public.messages (chat_id, inserted_at desc);

-- Note: the function gen_random_uuid requires pgcrypto or extension "pgcrypto" or "uuid-ossp".
-- If gen_random_uuid is not available, use uuid_generate_v4() and enable extension: create extension if not exists "uuid-ossp";

-- End of script
