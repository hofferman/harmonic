-- WhatsApp por membro: usado no convite e no aviso de escala.
-- IF NOT EXISTS: a coluna já existe em produção (criada fora das migrations).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Admin edita nome e WhatsApp de outros membros. Sem esta policy, o UPDATE de terceiros
-- falha em silêncio (0 linhas). Policy de UPDATE é permissiva e soma com
-- "Users can update own profile". Não cria acesso de leitura nem de inserção.
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Privilégios: o default do Supabase dá ALL a anon e authenticated, incluindo TRUNCATE
-- (que RLS não bloqueia) e UPDATE em todas as colunas. O app só escreve nome, telefone
-- e must_change_password (Membros.tsx e ChangePassword.tsx). Libera só isso.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE (nome, telefone, must_change_password) ON public.profiles TO authenticated;
