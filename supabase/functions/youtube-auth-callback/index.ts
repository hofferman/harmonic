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
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('YOUTUBE_REDIRECT_URI');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.');
    }

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Variaveis YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e YOUTUBE_REDIRECT_URI sao obrigatorias.');
    }

    // Verify user is authenticated and is admin
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

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: roleError } = await adminClient.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });

    if (roleError) throw roleError;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas admins podem conectar o YouTube.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: 'Codigo de autorizacao nao fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange code for tokens with Google OAuth
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Erro ao obter tokens do Google: ${errorData.error_description || errorData.error}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!refresh_token) {
      throw new Error('Refresh token nao recebido. Por favor, tente novamente com prompt=consent.');
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get YouTube channel info
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }
    );

    let youtubeChannelId = null;
    let youtubeChannelName = null;

    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      if (channelData.items && channelData.items.length > 0) {
        youtubeChannelId = channelData.items[0].id;
        youtubeChannelName = channelData.items[0].snippet.title;
      }
    }

    // Delete existing tokens and insert new ones (singleton pattern)
    await adminClient.from('youtube_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: insertError } = await adminClient
      .from('youtube_tokens')
      .insert({
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        youtube_channel_id: youtubeChannelId,
        youtube_channel_name: youtubeChannelName,
      });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      success: true,
      youtubeChannelId,
      youtubeChannelName,
      expiresAt: expiresAt.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar callback do YouTube.';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
