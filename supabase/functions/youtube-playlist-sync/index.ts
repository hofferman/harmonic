import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YouTubeToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  youtube_channel_id: string | null;
  youtube_channel_name: string | null;
}

interface YouTubeSearchResult {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
    };
  }>;
}

// Refresh Google access token if expired
async function refreshAccessToken(
  adminClient: ReturnType<typeof createClient>,
  token: YouTubeToken,
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
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao renovar token do YouTube. Por favor, reconecte sua conta.');
  }

  const data = await response.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update token in database
  await adminClient
    .from('youtube_tokens')
    .update({
      access_token: data.access_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('refresh_token', token.refresh_token);

  return data.access_token;
}

// Search for a video on YouTube
async function searchVideo(
  accessToken: string,
  title: string,
  artist: string | null
): Promise<{ videoId: string; title: string } | null> {
  const query = artist ? `${title} ${artist}` : title;
  const encodedQuery = encodeURIComponent(query);

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodedQuery}`,
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

  const data: YouTubeSearchResult = await response.json();
  if (data.items && data.items.length > 0) {
    return {
      videoId: data.items[0].id.videoId,
      title: data.items[0].snippet.title,
    };
  }
  return null;
}

// Create a new YouTube playlist
async function createPlaylist(
  accessToken: string,
  title: string,
  description: string
): Promise<{ id: string; url: string }> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus: 'unlisted', // or 'public' or 'private'
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao criar playlist YouTube: ${error}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    url: `https://www.youtube.com/playlist?list=${data.id}`,
  };
}

// Update playlist metadata
async function updatePlaylist(
  accessToken: string,
  playlistId: string,
  title: string,
  description: string
): Promise<void> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/playlists?part=snippet',
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: playlistId,
        snippet: {
          title,
          description,
        },
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to update playlist:', await response.text());
  }
}

// Get all items from a playlist
async function getPlaylistItems(
  accessToken: string,
  playlistId: string
): Promise<string[]> {
  const itemIds: string[] = [];
  let pageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=id&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      break;
    }

    const data = await response.json();
    for (const item of data.items || []) {
      itemIds.push(item.id);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return itemIds;
}

// Delete a playlist item
async function deletePlaylistItem(
  accessToken: string,
  itemId: string
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?id=${itemId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
}

// Add video to playlist
async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string
): Promise<void> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    console.error(`Failed to add video ${videoId} to playlist:`, await response.text());
  }
}

// Clear and repopulate playlist
async function replacePlaylistVideos(
  accessToken: string,
  playlistId: string,
  videoIds: string[]
): Promise<void> {
  // Get existing items
  const existingItems = await getPlaylistItems(accessToken, playlistId);

  // Delete all existing items
  for (const itemId of existingItems) {
    await deletePlaylistItem(accessToken, itemId);
  }

  // Add new videos
  for (const videoId of videoIds) {
    await addVideoToPlaylist(accessToken, playlistId, videoId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.');
    }

    if (!clientId || !clientSecret) {
      throw new Error('Variaveis YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET sao obrigatorias.');
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

    // Get YouTube tokens
    const { data: tokenData, error: tokenError } = await adminClient
      .from('youtube_tokens')
      .select('*')
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({
        error: 'YouTube nao conectado. Por favor, conecte sua conta YouTube primeiro.',
        needsAuth: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token if needed
    const accessToken = await refreshAccessToken(
      adminClient,
      tokenData as YouTubeToken,
      clientId,
      clientSecret
    );

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

    // Search for videos on YouTube
    const videoIds: string[] = [];
    const notFound: string[] = [];

    for (const item of escalaMusicas || []) {
      if (!item.musica) continue;

      const video = await searchVideo(
        accessToken,
        item.musica.titulo,
        item.musica.artista
      );

      if (video) {
        videoIds.push(video.videoId);
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

    if (existingPlaylist?.youtube_playlist_id) {
      // Update existing playlist
      playlistId = existingPlaylist.youtube_playlist_id;
      playlistUrl = existingPlaylist.youtube_playlist_url || `https://www.youtube.com/playlist?list=${playlistId}`;

      // Update name/description
      await updatePlaylist(accessToken, playlistId, playlistName, playlistDescription);

      // Replace videos
      await replacePlaylistVideos(accessToken, playlistId, videoIds);

      // Update escala_playlists record
      await adminClient
        .from('escala_playlists')
        .update({
          youtube_playlist_url: playlistUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('escala_id', escala_id);
    } else {
      // Create new playlist
      const newPlaylist = await createPlaylist(
        accessToken,
        playlistName,
        playlistDescription
      );

      playlistId = newPlaylist.id;
      playlistUrl = newPlaylist.url;

      // Add videos
      for (const videoId of videoIds) {
        await addVideoToPlaylist(accessToken, playlistId, videoId);
      }

      // Save playlist info
      if (existingPlaylist) {
        await adminClient
          .from('escala_playlists')
          .update({
            youtube_playlist_id: playlistId,
            youtube_playlist_url: playlistUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('escala_id', escala_id);
      } else {
        await adminClient
          .from('escala_playlists')
          .insert({
            escala_id,
            youtube_playlist_id: playlistId,
            youtube_playlist_url: playlistUrl,
          });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      playlistId,
      playlistUrl,
      videosFound: videoIds.length,
      videosNotFound: notFound,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar playlist YouTube.';
    console.error('YouTube sync error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
