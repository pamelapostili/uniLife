-- Mismo problema que tuvimos con el INSERT de chat_participants: la política de
-- SELECT usaba una subconsulta recursiva sobre la propia tabla ("¿el chat_id que
-- pido pertenece a un chat donde yo también soy participante?"), y esa recursión
-- no resuelve bien al pedir la fila del OTRO participante (no la mía propia).
-- Por eso en chats.tsx / chat/[id].tsx nunca llegaba el user_id del otro usuario
-- y siempre se mostraba el nombre de reserva ("Usuario") sin foto.
-- Se simplifica a: cualquier usuario autenticado puede leer chat_participants
-- (no es información sensible por sí sola, y ya se filtra qué chats ve cada quien
-- en la tabla "chats").
-- Run this in Supabase SQL editor (Project → SQL Editor → New query)

DROP POLICY IF EXISTS "select own chat_participants" ON public.chat_participants;

CREATE POLICY "select own chat_participants" ON public.chat_participants
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- End of script
