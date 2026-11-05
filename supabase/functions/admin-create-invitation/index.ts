import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

// Formato internacional 55 + DDD + número (12 ou 13 dígitos).
// 10–11 dígitos = DDD + número, sem código do país: prefixa 55.
// 12–13 dígitos já começando com 55 = código do país informado.
// Ambíguo só quando o DDD é 55 (RS): 55999998888 vira 5555999998888.
const normalizarTelefone = (bruto: string): string | null => {
  const d = bruto.replace(/\D/g, '');
  let comPais: string | null = null;
  if (d.length === 10 || d.length === 11) comPais = `55${d}`;
  else if ((d.length === 12 || d.length === 13) && d.startsWith('55')) comPais = d;
  if (!comPais) return null;
  return /^55[1-9][0-9]([0-9]{8}|[0-9]{9})$/.test(comPais) ? comPais : null;
};

// Percorre todas as páginas de usuários (listUsers devolve no máximo perPage por chamada).
const emailJaCadastrado = async (
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<boolean> => {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    if (data.users.some((u) => u.email?.toLowerCase() === email)) return true;
    if (data.users.length < perPage) return false;
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return new Response(JSON.stringify({ error: 'Apenas admins podem criar convites.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const nome = String(body.nome ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const telefone = normalizarTelefone(String(body.telefone ?? ''));

    if (!nome || !email) {
      return new Response(JSON.stringify({ error: 'Nome e email sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!telefone) {
      return new Response(JSON.stringify({ error: 'WhatsApp invalido. Use DDD + numero, ex: (11) 98765-4321.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email already registered (percorre todas as páginas)
    if (await emailJaCadastrado(adminClient, email)) {
      return new Response(JSON.stringify({ error: 'Este email ja esta cadastrado no sistema.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await adminClient
      .from('invitations')
      .select('id')
      .eq('email', email)
      .is('accepted_at', null)
      .maybeSingle();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: 'Ja existe um convite pendente para este email.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate secure token
    const { data: tokenData, error: tokenError } = await adminClient.rpc('generate_invitation_token');
    if (tokenError) throw tokenError;

    const token = tokenData as string;

    // Create invitation
    const { data: invitation, error: inviteError } = await adminClient
      .from('invitations')
      .insert({
        token,
        email,
        nome,
        telefone,
        invited_by: requesterData.user.id,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Build invitation URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://harmonic.igrejaabrace.com.br';
    const inviteUrl = `${siteUrl}/aceitar-convite?token=${token}`;

    return new Response(JSON.stringify({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        nome: invitation.nome,
        telefone: invitation.telefone,
        expires_at: invitation.expires_at,
      },
      inviteUrl,
      token,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar convite.';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
