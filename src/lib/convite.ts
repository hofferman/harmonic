import { supabase } from '@/integrations/supabase/client';

export type ResultadoConvite = {
  inviteUrl: string;
  whatsappEnviado: boolean;
  erroWhatsapp?: string;
};

// Mesma regra da Edge Function admin-create-invitation: 55 + DDD + número.
// 10–11 dígitos = DDD + número (prefixa 55). 12–13 dígitos começando com 55 = já tem código do país.
export const normalizarTelefoneConvite = (bruto: string): string | null => {
  const d = bruto.replace(/\D/g, '');
  let comPais: string | null = null;
  if (d.length === 10 || d.length === 11) comPais = `55${d}`;
  else if ((d.length === 12 || d.length === 13) && d.startsWith('55')) comPais = d;
  if (!comPais) return null;
  return /^55[1-9][0-9]([0-9]{8}|[0-9]{9})$/.test(comPais) ? comPais : null;
};

// Lê a mensagem de erro do corpo da resposta da Edge Function (supabase-js lança em não-2xx).
export const mensagemDeErro = async (error: unknown, fallback: string): Promise<string> => {
  const contexto = (error as { context?: Response })?.context;
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.json();
      if (corpo?.error) return String(corpo.error);
    } catch {
      // corpo não é JSON: cai no fallback
    }
  }
  return (error as Error)?.message || fallback;
};

// Cria o convite (sem senha) e tenta enviar pelo WhatsApp.
// Se o envio falhar, o convite continua válido: o admin pode copiar o link.
export async function criarConvite(params: {
  nome: string;
  email: string;
  telefone: string;
}): Promise<ResultadoConvite> {
  const { data, error } = await supabase.functions.invoke('admin-create-invitation', {
    body: params,
  });

  if (error) {
    throw new Error(await mensagemDeErro(error, 'Erro ao criar convite.'));
  }

  const invitationId: string | undefined = data?.invitation?.id;
  const inviteUrl: string | undefined = data?.inviteUrl;
  if (!invitationId || !inviteUrl) {
    throw new Error('Resposta inválida ao criar convite.');
  }

  const { error: sendError } = await supabase.functions.invoke('send-whatsapp-invitation', {
    body: { invitationId },
  });

  if (sendError) {
    return {
      inviteUrl,
      whatsappEnviado: false,
      erroWhatsapp: await mensagemDeErro(sendError, 'Falha ao enviar pelo WhatsApp.'),
    };
  }

  return { inviteUrl, whatsappEnviado: true };
}
