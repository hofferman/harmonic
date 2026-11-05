\set ON_ERROR_STOP 0
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000aaaa','admin@x.com'), ('00000000-0000-0000-0000-00000000bbbb','membro@x.com');
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-00000000aaaa','admin'), ('00000000-0000-0000-0000-00000000bbbb','membro');
INSERT INTO public.whatsapp_outbox (destino, mensagem) VALUES ('5511988311767','teste');
INSERT INTO public.invitations (token, email, nome, invited_by, telefone) VALUES ('tok123','novo@x.com','Novo','00000000-0000-0000-0000-00000000aaaa','5511988311767');

\echo --- A: anon generate_invitation_token (esperado: negado)
SET ROLE anon; SELECT public.generate_invitation_token();
RESET ROLE;
\echo --- B: anon validate_invitation (esperado: funciona)
SET ROLE anon; SELECT is_valid, reason FROM public.validate_invitation('tok123');
RESET ROLE;
\echo --- C: service_role generate (esperado: funciona)
SET ROLE service_role; SELECT length(public.generate_invitation_token()) AS tamanho_token;
RESET ROLE;
\echo --- D: anon select whatsapp_outbox (esperado: negado)
SET ROLE anon; SELECT count(*) FROM public.whatsapp_outbox;
RESET ROLE;
\echo --- E: membro select whatsapp_outbox (esperado: 0 linhas)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
SELECT count(*) AS membro_ve FROM public.whatsapp_outbox;
RESET ROLE;
\echo --- F: membro insert whatsapp_outbox (esperado: negado por RLS)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
INSERT INTO public.whatsapp_outbox (destino, mensagem) VALUES ('5511999999999','x');
RESET ROLE;
\echo --- G: admin select whatsapp_outbox (esperado: 1 linha)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
SELECT count(*) AS admin_ve FROM public.whatsapp_outbox;
RESET ROLE;
\echo --- H: admin insert whatsapp_outbox direto (esperado: negado, só a Edge Function escreve)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
INSERT INTO public.whatsapp_outbox (destino, mensagem) VALUES ('5511999999999','x');
RESET ROLE;
\echo --- I: membro select invitations (esperado: 0 linhas)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
SELECT count(*) AS membro_convites FROM public.invitations;
RESET ROLE;
\echo --- J: admin update accepted_at em invitations (esperado: 0 linhas afetadas, sem policy de UPDATE)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
UPDATE public.invitations SET accepted_at = now() WHERE token = 'tok123';
RESET ROLE;
\echo --- K: estado final da fila e do convite
SELECT count(*) AS fila_total FROM public.whatsapp_outbox;
SELECT count(*) AS convites_aceitos FROM public.invitations WHERE accepted_at IS NOT NULL;

\echo --- L: membro TRUNCATE whatsapp_outbox (esperado: negado)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
TRUNCATE public.whatsapp_outbox;
RESET ROLE;
\echo --- M: membro TRUNCATE invitations (esperado: negado)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
TRUNCATE public.invitations;
RESET ROLE;
\echo --- N: admin insert invitations direto (esperado: negado, criação só pela Edge Function)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
INSERT INTO public.invitations (token, email, nome, invited_by) VALUES ('tok-direto','d@x.com','D','00000000-0000-0000-0000-00000000aaaa');
RESET ROLE;
\echo --- O: membro DELETE invitations (esperado: 0 linhas, RLS)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
DELETE FROM public.invitations WHERE token = 'tok123';
RESET ROLE;
\echo --- P: contagens finais (esperado: fila 1 e convite tok123 ainda existe)
SELECT count(*) AS fila_final FROM public.whatsapp_outbox;
SELECT count(*) AS convite_tok123 FROM public.invitations WHERE token = 'tok123';

-- Perfis: WhatsApp de membro (migration 20261104020000)
INSERT INTO public.profiles (id, nome) VALUES ('00000000-0000-0000-0000-00000000aaaa','Admin'), ('00000000-0000-0000-0000-00000000bbbb','Membro');
\echo --- Q: membro edita WhatsApp de outro (admin) (esperado: UPDATE 0)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
UPDATE public.profiles SET telefone = '5511900000001' WHERE id = '00000000-0000-0000-0000-00000000aaaa';
RESET ROLE;
\echo --- R: admin edita WhatsApp de membro (esperado: UPDATE 1)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
UPDATE public.profiles SET telefone = '5511988311767' WHERE id = '00000000-0000-0000-0000-00000000bbbb';
RESET ROLE;
\echo --- S: membro edita o próprio WhatsApp (esperado: UPDATE 1)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
UPDATE public.profiles SET telefone = '5511977776666' WHERE id = '00000000-0000-0000-0000-00000000bbbb';
RESET ROLE;
\echo --- T: valor gravado (esperado: membro com 5511977776666, admin com NULL)
SELECT nome, telefone FROM public.profiles ORDER BY nome;
\echo --- U: membro TRUNCATE profiles (esperado: negado)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
TRUNCATE public.profiles;
RESET ROLE;
\echo --- V: membro altera a própria coluna id (esperado: negado, coluna sem GRANT)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
UPDATE public.profiles SET id = '00000000-0000-0000-0000-00000000cccc' WHERE id = '00000000-0000-0000-0000-00000000bbbb';
RESET ROLE;
\echo --- W: anon lê profiles (esperado: negado)
SET ROLE anon; SELECT count(*) FROM public.profiles;
RESET ROLE;
\echo --- X: membro troca must_change_password de si (esperado: UPDATE 1, coluna com GRANT)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
UPDATE public.profiles SET must_change_password = false WHERE id = '00000000-0000-0000-0000-00000000bbbb';
RESET ROLE;
