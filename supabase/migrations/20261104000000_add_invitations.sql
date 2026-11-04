-- Add invitations table for WhatsApp-based user invitations
-- Admin creates invitation → sends via WhatsApp → user accepts with new password

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  telefone TEXT, -- normalized international format 55DDDNNNNNNNNN
  nome TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT invitations_email_pending_unique UNIQUE NULLS NOT DISTINCT (email, accepted_at)
);

-- Index for fast token lookups (acceptance flow)
CREATE INDEX invitations_token_idx ON public.invitations (token) WHERE accepted_at IS NULL;

-- Index for admin listing pending invitations
CREATE INDEX invitations_pending_idx ON public.invitations (created_at DESC) WHERE accepted_at IS NULL;

-- RLS policies
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can read all invitations
CREATE POLICY "Admins can read invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete pending invitations (revoke)
CREATE POLICY "Admins can delete pending invitations"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (
    accepted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to generate secure random token
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Function to validate invitation (used by Edge Function)
CREATE OR REPLACE FUNCTION public.validate_invitation(p_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  email TEXT,
  nome TEXT,
  telefone TEXT,
  is_valid BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 
      FALSE, 'Convite não encontrado'::TEXT;
    RETURN;
  END IF;
  
  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_inv.id, v_inv.email, v_inv.nome, v_inv.telefone,
      FALSE, 'Convite já utilizado'::TEXT;
    RETURN;
  END IF;
  
  IF v_inv.expires_at < now() THEN
    RETURN QUERY SELECT 
      v_inv.id, v_inv.email, v_inv.nome, v_inv.telefone,
      FALSE, 'Convite expirado'::TEXT;
    RETURN;
  END IF;
  
  -- Check if email already registered
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_inv.email) THEN
    RETURN QUERY SELECT 
      v_inv.id, v_inv.email, v_inv.nome, v_inv.telefone,
      FALSE, 'Email já cadastrado no sistema'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    v_inv.id, v_inv.email, v_inv.nome, v_inv.telefone,
    TRUE, NULL::TEXT;
END;
$$;

-- Grant execute to service role for Edge Functions
GRANT EXECUTE ON FUNCTION public.generate_invitation_token() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_invitation(TEXT) TO service_role;

COMMENT ON TABLE public.invitations IS 'Convites para novos usuários enviados por WhatsApp';
COMMENT ON COLUMN public.invitations.token IS 'Token único e seguro para aceitar o convite';
COMMENT ON COLUMN public.invitations.telefone IS 'WhatsApp em formato internacional 55DDDNNNNNNNNN';
