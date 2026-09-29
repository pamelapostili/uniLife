-- Agrega el autor real (user_id) a los foros, para poder enlazar cada
-- publicación a su perfil y permitir enviarle un mensaje directo.
-- Los foros creados antes de este cambio quedarán con user_id = null
-- (no se puede recuperar de forma confiable desde el campo "autor", que
-- guarda solo el email en texto plano).
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

alter table public.foros
  add column if not exists user_id uuid references auth.users(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_foros_user_id ON public.foros (user_id);

-- End of script
