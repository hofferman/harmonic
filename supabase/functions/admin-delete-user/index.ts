import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

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
      return new Response(JSON.stringify({ error: 'Apenas admins podem excluir usuarios.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const userId = String(body.userId ?? '').trim();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Usuario obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userId === requesterData.user.id) {
      return new Response(JSON.stringify({ error: 'Voce nao pode excluir seu proprio usuario.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir usuario.';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
