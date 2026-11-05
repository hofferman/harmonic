-- Tokens do YouTube: admin vê status e desconecta; membro não vê nada; refresh_token nunca legível pelo navegador.
INSERT INTO public.youtube_tokens (access_token, refresh_token, expires_at, youtube_channel_name)
VALUES ('acc-secreto', 'ref-secreto', now() + interval '1 hour', 'Igreja Teste');
\echo --- Z1: admin lê status (esperado: 1 linha)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
SELECT count(*) AS admin_le_status FROM (SELECT id, expires_at, youtube_channel_name FROM public.youtube_tokens) t;
RESET ROLE;
\echo --- Z2: admin lê refresh_token (esperado: permission denied)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
SELECT refresh_token FROM public.youtube_tokens;
RESET ROLE;
\echo --- Z3: membro lê status (esperado: 0 linhas, RLS)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
SELECT count(*) AS membro_le FROM (SELECT id FROM public.youtube_tokens) t;
RESET ROLE;
\echo --- Z4: membro desconecta (esperado: DELETE 0)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bbbb',false);
DELETE FROM public.youtube_tokens;
RESET ROLE;
\echo --- Z5: anon lê (esperado: permission denied)
SET ROLE anon; SELECT count(*) FROM public.youtube_tokens;
RESET ROLE;
\echo --- Z6: admin desconecta (esperado: DELETE 1)
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000aaaa',false);
DELETE FROM public.youtube_tokens;
RESET ROLE;
