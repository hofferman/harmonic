-- Fila de envio de WhatsApp. A Edge Function grava aqui; um script no host
-- (scripts/whatsapp-outbox/enviar_fila.py) lê a fila e envia pela Evolution API,
-- que só escuta em loopback no VPS.

CREATE TABLE public.whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destino TEXT NOT NULL,                -- formato internacional 55DDDNNNNNNNNN
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'falhou')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_at TIMESTAMPTZ
);

-- Índice parcial: o script só olha o que está pendente.
CREATE INDEX whatsapp_outbox_pendente_idx
  ON public.whatsapp_outbox (created_at)
  WHERE status = 'pendente';

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- Admins podem ver a fila (para conferir envios). Não há policy de INSERT/UPDATE/DELETE
-- para usuários: a escrita é só da Edge Function (service_role, ignora RLS) e do script no host.
CREATE POLICY "Admins leem a fila de WhatsApp"
  ON public.whatsapp_outbox FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

REVOKE ALL ON public.whatsapp_outbox FROM anon;

COMMENT ON TABLE public.whatsapp_outbox IS 'Fila de mensagens de WhatsApp enviadas pelo script no host via Evolution API';
