import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpotifyToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  spotify_user_id: string | null;
}

interface SearchResult {
  tracks: {
    items: Array<{
      id: string;
      uri: string;
      name: string;
      artists: Array<{ name: string }>;
    }>;
  };
}

// Refresh Spotify access token if expired
async function refreshAccessToken(
  adminClient: ReturnType<typeof createClient>,
  token: SpotifyToken,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  
  // If token is not expired (with 5 min buffer), return it
  if (expiresAt.getTime() - 5 * 60 * 1000 > now.getTime()) {
    return token.access_token;
  }

  // Refresh the token
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao renovar token do Spotify. Por favor, reconecte sua conta.');
  }

  const data = await response.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update token in database
  await adminClient
    .from('spotify_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || token.refresh_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('refresh_token', token.refresh_token);

  return data.access_token;
}

// Search for a track on Spotify
async function searchTrack(
  accessToken: string,
  title: string,
  artist: string | null
): Promise<string | null> {
  const query = artist ? `track:${title} artist:${artist}` : `track:${title}`;
  const encodedQuery = encodeURIComponent(query);
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    console.error(`Search failed for ${title}:`, await response.text());
    return null;
  }

  const data: SearchResult = await response.json();
  return data.tracks.items[0]?.uri || null;
}

// Create a new playlist
async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string
): Promise<{ id: string; url: string }> {
  const response = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        public: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao criar playlist: ${error}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    url: data.external_urls.spotify,
  };
}

// Replace all tracks in a playlist
async function replacePlaylistTracks(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: trackUris,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao atualizar tracks da playlist: ${error}`);
  }
}

// Update playlist name/description
async function updatePlaylistDetails(
  accessToken: string,
  playlistId: string,
  name: string,
  description: string
): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to update playlist details:', await response.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.');
    }

    if (!clientId || !clientSecret) {
      throw new Error('Variaveis SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET sao obrigatorias.');
    }

    // Verify user is authenticated
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

    const body = await req.json();
    const { escala_id } = body;

    if (!escala_id) {
      return new Response(JSON.stringify({ error: 'escala_id e obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Spotify tokens
    const { data: tokenData, error: tokenError } = await adminClient
      .from('spotify_tokens')
      .select('*')
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ 
        error: 'Spotify nao conectado. Por favor, conecte sua conta Spotify primeiro.',
        needsAuth: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token if needed
    const accessToken = await refreshAccessToken(
      adminClient,
      tokenData as SpotifyToken,
      clientId,
      clientSecret
    );

    if (!tokenData.spotify_user_id) {
      return new Response(JSON.stringify({ 
        error: 'ID do usuario Spotify nao encontrado. Por favor, reconecte sua conta.',
        needsAuth: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get escala with setor info
    const { data: escala, error: escalaError } = await adminClient
      .from('escalas')
      .select(`
        id,
        data,
        titulo,
        setor:setores(nome)
      `)
      .eq('id', escala_id)
      .single();

    if (escalaError || !escala) {
      return new Response(JSON.stringify({ error: 'Escala nao encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get musicas from escala
    const { data: escalaMusicas, error: musicasError } = await adminClient
      .from('escala_musicas')
      .select(`
        ordem,
        musica:musicas(titulo, artista)
      `)
      .eq('escala_id', escala_id)
      .order('ordem');

    if (musicasError) {
      throw new Error('Erro ao buscar musicas da escala.');
    }

    // Format playlist name
    const escalaDate = new Date(escala.data + 'T12:00:00');
    const formattedDate = escalaDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const setorName = (escala.setor as { nome?: string } | null)?.nome || 'Louvor';
    const playlistName = `Escala ${formattedDate} - ${setorName}`;
    const playlistDescription = `Repertório da escala de ${formattedDate} - ${escala.titulo || setorName}. Gerado automaticamente pelo Harmonic.`;

    // Search for tracks on Spotify
    const trackUris: string[] = [];
    const notFound: string[] = [];

    for (const item of escalaMusicas || []) {
      if (!item.musica) continue;
      
      const uri = await searchTrack(
        accessToken,
        item.musica.titulo,
        item.musica.artista
      );

      if (uri) {
        trackUris.push(uri);
      } else {
        notFound.push(`${item.musica.titulo}${item.musica.artista ? ` - ${item.musica.artista}` : ''}`);
      }
    }

    // Check if playlist already exists for this escala
    const { data: existingPlaylist } = await adminClient
      .from('escala_playlists')
      .select('*')
      .eq('escala_id', escala_id)
      .single();

    let playlistId: string;
    let playlistUrl: string;

    if (existingPlaylist?.spotify_playlist_id) {
      // Update existing playlist
      playlistId = existingPlaylist.spotify_playlist_id;
      playlistUrl = existingPlaylist.spotify_playlist_url || `https://open.spotify.com/playlist/${playlistId}`;
      
      // Update name/description
      await updatePlaylistDetails(accessToken, playlistId, playlistName, playlistDescription);
      
      // Replace tracks
      await replacePlaylistTracks(accessToken, playlistId, trackUris);

      // Update escala_playlists record
      await adminClient
        .from('escala_playlists')
        .update({
          spotify_playlist_url: playlistUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('escala_id', escala_id);
    } else {
      // Create new playlist
      const newPlaylist = await createPlaylist(
        accessToken,
        tokenData.spotify_user_id,
        playlistName,
        playlistDescription
      );
      
      playlistId = newPlaylist.id;
      playlistUrl = newPlaylist.url;

      // Add tracks
      if (trackUris.length > 0) {
        await replacePlaylistTracks(accessToken, playlistId, trackUris);
      }

      // Save playlist info
      if (existingPlaylist) {
        await adminClient
          .from('escala_playlists')
          .update({
            spotify_playlist_id: playlistId,
            spotify_playlist_url: playlistUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('escala_id', escala_id);
      } else {
        await adminClient
          .from('escala_playlists')
          .insert({
            escala_id,
            spotify_playlist_id: playlistId,
            spotify_playlist_url: playlistUrl,
          });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      playlistId,
      playlistUrl,
      tracksFound: trackUris.length,
      tracksNotFound: notFound,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar playlist.';
    console.error('Spotify sync error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
