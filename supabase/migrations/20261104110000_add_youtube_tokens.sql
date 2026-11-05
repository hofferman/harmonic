-- Tokens do YouTube (OAuth da igreja). Usada pelas Edge Functions youtube-auth-callback
-- e youtube-playlist-sync (service_role) e pela aba Integrações (admin: ler status e desconectar).
-- IF NOT EXISTS: a tabela já existe em produção, criada fora das migrations.
CREATE TABLE IF NOT EXISTS public.youtube_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  youtube_channel_id TEXT,
  youtube_channel_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_tokens ENABLE ROW LEVEL SECURITY;

-- Só admin lê e desconecta. Nenhum usuário grava: a escrita é das Edge Functions (service_role).
DROP POLICY IF EXISTS "Admins can read youtube_tokens" ON public.youtube_tokens;
CREATE POLICY "Admins can read youtube_tokens"
  ON public.youtube_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete youtube_tokens" ON public.youtube_tokens;
CREATE POLICY "Admins can delete youtube_tokens"
  ON public.youtube_tokens FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Privilégios: o default do Supabase dá ALL. Remove e libera só o necessário.
-- O refresh_token e o access_token NÃO são legíveis pelo navegador: a aba Integrações
-- só precisa de status (canal e expiração).
REVOKE ALL ON public.youtube_tokens FROM anon, authenticated;
GRANT SELECT (id, expires_at, youtube_channel_id, youtube_channel_name, created_at, updated_at)
  ON public.youtube_tokens TO authenticated;
GRANT DELETE ON public.youtube_tokens TO authenticated;
