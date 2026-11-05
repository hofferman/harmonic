import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface YouTubePlaylist {
  youtube_playlist_id: string | null;
  youtube_playlist_url: string | null;
}

interface SyncResult {
  success: boolean;
  playlistId?: string;
  playlistUrl?: string;
  videosFound?: number;
  videosNotFound?: string[];
  error?: string;
  needsAuth?: boolean;
}

export function useYouTube() {
  const { session, isAdmin } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check if YouTube is connected (tokens exist)
  const checkConnection = useCallback(async () => {
    if (!session) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('youtube_tokens')
        .select('id, expires_at')
        .limit(1)
        .maybeSingle();

      if (error) {
        // Table might not exist yet or RLS denies access
        console.log('YouTube tokens check:', error.message);
        setIsConnected(false);
      } else {
        setIsConnected(!!data);
      }
    } catch (err) {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Start OAuth flow
  const startAuth = async (): Promise<{ authUrl: string } | { error: string }> => {
    if (!session?.access_token) {
      return { error: 'Você precisa estar logado.' };
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-auth-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { error: data.error || 'Erro ao iniciar autenticação' };
      }

      return { authUrl: data.authUrl };
    } catch (err) {
      return { error: 'Erro de conexão ao iniciar autenticação' };
    }
  };

  // Handle OAuth callback
  const handleCallback = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!session?.access_token) {
      return { success: false, error: 'Você precisa estar logado.' };
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-auth-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Erro ao processar callback' };
      }

      // Refresh connection status
      await checkConnection();
      
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro de conexão ao processar callback' };
    }
  };

  // Sync playlist for an escala
  const syncPlaylist = async (escalaId: string): Promise<SyncResult> => {
    if (!session?.access_token) {
      return { success: false, error: 'Você precisa estar logado.' };
    }

    setIsSyncing(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/youtube-playlist-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ escala_id: escalaId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || 'Erro ao sincronizar playlist',
          needsAuth: data.needsAuth,
        };
      }

      return {
        success: true,
        playlistId: data.playlistId,
        playlistUrl: data.playlistUrl,
        videosFound: data.videosFound,
        videosNotFound: data.videosNotFound,
      };
    } catch (err) {
      return { success: false, error: 'Erro de conexão ao sincronizar playlist' };
    } finally {
      setIsSyncing(false);
    }
  };

  // Get playlist info for an escala
  const getPlaylistInfo = async (escalaId: string): Promise<YouTubePlaylist | null> => {
    try {
      const { data, error } = await supabase
        .from('escala_playlists')
        .select('youtube_playlist_id, youtube_playlist_url')
        .eq('escala_id', escalaId)
        .maybeSingle();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  };

  return {
    isConnected,
    isLoading,
    isSyncing,
    isAdmin,
    startAuth,
    handleCallback,
    syncPlaylist,
    getPlaylistInfo,
    refreshConnection: checkConnection,
  };
}
