import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSpotify } from '@/hooks/useSpotify';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Music, RefreshCw, Link2 } from 'lucide-react';

interface SpotifyPlaylistButtonProps {
  escalaId: string;
  musicasCount: number;
  onSyncComplete?: () => void;
}

// Spotify brand green
const SPOTIFY_GREEN = '#1DB954';

export default function SpotifyPlaylistButton({ 
  escalaId, 
  musicasCount,
  onSyncComplete 
}: SpotifyPlaylistButtonProps) {
  const { isConnected, isLoading, isSyncing, syncPlaylist, getPlaylistInfo, startAuth, isAdmin } = useSpotify();
  const { toast } = useToast();
  
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true);

  useEffect(() => {
    loadPlaylistInfo();
  }, [escalaId]);

  const loadPlaylistInfo = async () => {
    setIsLoadingPlaylist(true);
    const info = await getPlaylistInfo(escalaId);
    setPlaylistUrl(info?.spotify_playlist_url || null);
    setIsLoadingPlaylist(false);
  };

  const handleSync = async () => {
    if (musicasCount === 0) {
      toast({
        title: 'Sem músicas',
        description: 'Adicione músicas ao repertório antes de criar a playlist.',
        variant: 'destructive',
      });
      return;
    }

    const result = await syncPlaylist(escalaId);
    
    if (result.success) {
      setPlaylistUrl(result.playlistUrl || null);
      
      if (result.tracksNotFound && result.tracksNotFound.length > 0) {
        toast({
          title: 'Playlist atualizada',
          description: `${result.tracksFound} músicas encontradas. ${result.tracksNotFound.length} não encontradas no Spotify: ${result.tracksNotFound.slice(0, 3).join(', ')}${result.tracksNotFound.length > 3 ? '...' : ''}`,
        });
      } else {
        toast({
          title: 'Playlist sincronizada!',
          description: `${result.tracksFound} músicas adicionadas à playlist.`,
        });
      }
      
      onSyncComplete?.();
    } else if (result.needsAuth) {
      // Need to connect Spotify first
      handleConnect();
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Erro ao sincronizar playlist.',
        variant: 'destructive',
      });
    }
  };

  const handleConnect = async () => {
    const result = await startAuth();
    
    if ('authUrl' in result) {
      // Open in the same window for OAuth flow
      window.location.href = result.authUrl;
    } else {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  if (isLoading || isLoadingPlaylist) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  // If not connected and admin, show connect button
  if (!isConnected && isAdmin) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleConnect}
        className="gap-2"
        style={{ borderColor: SPOTIFY_GREEN, color: SPOTIFY_GREEN }}
      >
        <Music className="h-4 w-4" />
        Conectar Spotify
      </Button>
    );
  }

  // If not connected and not admin, don't show anything
  if (!isConnected) {
    return null;
  }

  // Connected - show playlist controls
  return (
    <div className="flex flex-wrap items-center gap-2">
      {playlistUrl ? (
        <>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2"
            style={{ borderColor: SPOTIFY_GREEN, color: SPOTIFY_GREEN }}
          >
            <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
              <Music className="h-4 w-4" />
              Abrir Playlist
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
            title="Atualizar playlist"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || musicasCount === 0}
          className="gap-2"
          style={{ borderColor: SPOTIFY_GREEN, color: SPOTIFY_GREEN }}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {isSyncing ? 'Criando...' : 'Criar Playlist'}
        </Button>
      )}
    </div>
  );
}
