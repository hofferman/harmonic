INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000cccc','ja@x.com');
INSERT INTO public.invitations (token, email, nome, invited_by, telefone, expires_at) VALUES
 ('tok-email-existe','ja@x.com','Ja Cadastrado','00000000-0000-0000-0000-00000000aaaa','5511988311767', now() + interval '7 days'),
 ('tok-expirado','exp@x.com','Expirado','00000000-0000-0000-0000-00000000aaaa','5511988311767', now() - interval '1 day'),
 ('tok-aceito','aceito@x.com','Aceito','00000000-0000-0000-0000-00000000aaaa','5511988311767', now() + interval '7 days');
UPDATE public.invitations SET accepted_at = now() WHERE token = 'tok-aceito';
SET ROLE anon;
SELECT 'email_existe' AS caso, is_valid, reason FROM public.validate_invitation('tok-email-existe');
SELECT 'expirado' AS caso, is_valid, reason FROM public.validate_invitation('tok-expirado');
SELECT 'ja_aceito' AS caso, is_valid, reason FROM public.validate_invitation('tok-aceito');
SELECT 'inexistente' AS caso, is_valid, reason FROM public.validate_invitation('nao-existe');
RESET ROLE;
