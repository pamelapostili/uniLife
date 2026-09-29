
alter table public.foros
  add column if not exists user_id uuid references auth.users(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_foros_user_id ON public.foros (user_id);

