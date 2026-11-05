import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Esta função não fala com a Evolution API: a Evolution só escuta em loopback no VPS,
// e a Edge Function roda em container. Ela grava na fila whatsapp_outbox, e o script
// no host (scripts/whatsapp-outbox/enviar_fila.py) envia.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: requesterData, error: requesterError } = await userClient.auth.getUser();
    if (requesterError || !requesterData.user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: roleError } = await adminClient.rpc('has_role', {
      _user_id: requesterData.user.id,
      _role: 'admin',
    });

    if (roleError) throw roleError;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas admins podem enviar convites.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const invitationId = String(body.invitationId ?? '').trim();

    if (!invitationId) {
      return new Response(JSON.stringify({ error: 'ID do convite e obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get invitation details
    const { data: invitation, error: inviteError } = await adminClient
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: 'Convite nao encontrado ou ja utilizado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!invitation.telefone) {
      return new Response(JSON.stringify({ error: 'Convite nao possui telefone cadastrado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build invitation URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://harmonic.igrejaabrace.com.br';
    const inviteUrl = `${siteUrl}/aceitar-convite?token=${invitation.token}`;

    const texto = `🎵 *Convite para o Harmonic*

Olá, ${invitation.nome}!

Você foi convidado(a) para acessar o *Harmonic* - sistema de gestão de escalas e músicas da Igreja Abraçe.

Clique no link abaixo para criar sua senha e começar a usar:
${inviteUrl}

_Este convite expira em 7 dias._

Dúvidas? Entre em contato com a equipe de louvor.`;

    const { data: fila, error: filaError } = await adminClient
      .from('whatsapp_outbox')
      .insert({
        destino: invitation.telefone,
        mensagem: texto,
        created_by: requesterData.user.id,
      })
      .select('id')
      .single();

    if (filaError) {
      console.error('whatsapp_outbox insert error:', filaError);
      return new Response(JSON.stringify({
        error: 'Nao foi possivel colocar o WhatsApp na fila de envio.',
        code: 'WHATSAPP_QUEUE_FAILED',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      queued: true,
      outboxId: fila.id,
      message: 'Convite na fila para envio por WhatsApp.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar convite.';
    console.error('send-whatsapp-invitation error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
