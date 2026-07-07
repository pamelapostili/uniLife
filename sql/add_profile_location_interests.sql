-- Ejecutar en Supabase → SQL Editor.
-- Agrega a "profiles" las columnas que usan cercanos.tsx y perfil.tsx
-- (verificado contra el esquema real: hoy faltan interests/latitude/longitude).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude double precision;
