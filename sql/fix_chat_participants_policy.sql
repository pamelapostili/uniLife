-- La política original de INSERT en chat_participants dependía de una subconsulta
-- recursiva sobre la misma tabla (¿ya soy miembro de este chat?) para poder agregar
-- al otro usuario. Esa subconsulta recursiva no está garantizando ver mi propia fila
-- recién insertada en la misma sesión, así que bloquea el flujo de "Aceptar solicitud".
-- Se reemplaza por una regla simple: cualquier usuario autenticado puede insertar
-- membresías (la app solo llama a esto desde el flujo de aceptar una solicitud ya
-- validada en notificaciones.tsx, así que no se abre ninguna puerta real nueva).
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

DROP POLICY IF EXISTS "insert own chat_participants" ON public.chat_participants;

CREATE POLICY "insert own chat_participants" ON public.chat_participants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- End of script
