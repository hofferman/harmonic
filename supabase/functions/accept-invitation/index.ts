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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token do convite e obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate invitation using database function
    const { data: validation, error: validationError } = await adminClient
      .rpc('validate_invitation', { p_token: token })
      .single();

    if (validationError) throw validationError;

    if (!validation.is_valid) {
      return new Response(JSON.stringify({ 
        error: validation.reason || 'Convite invalido.',
        code: 'INVALID_INVITATION',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user with the provided password (already confirmed, no must_change_password)
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: validation.email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: validation.nome,
        must_change_password: false, // User chose their own password
      },
    });

    if (createError) {
      // Handle specific errors
      if (createError.message.includes('already registered')) {
        return new Response(JSON.stringify({ 
          error: 'Este email ja esta cadastrado no sistema.',
          code: 'EMAIL_EXISTS',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw createError;
    }

    // Update profile with telefone if provided
    if (validation.telefone) {
      await adminClient
        .from('profiles')
        .update({ 
          nome: validation.nome,
          telefone: validation.telefone,
          must_change_password: false,
        })
        .eq('id', userData.user.id);
    } else {
      await adminClient
        .from('profiles')
        .update({ 
          nome: validation.nome,
          must_change_password: false,
        })
        .eq('id', userData.user.id);
    }

    // Mark invitation as accepted
    await adminClient
      .from('invitations')
      .update({ 
        accepted_at: new Date().toISOString(),
        created_user_id: userData.user.id,
      })
      .eq('id', validation.invitation_id);

    // Sign in the user to return session
    const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
      email: validation.email,
      password,
    });

    if (signInError) {
      // User was created but signin failed - they can login manually
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Conta criada! Faca login com seu email e senha.',
        requiresManualLogin: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      session: signInData.session,
      user: signInData.user,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao aceitar convite.';
    console.error('accept-invitation error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
