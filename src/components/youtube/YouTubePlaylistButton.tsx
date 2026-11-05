import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useYouTube } from '@/hooks/useYouTube';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Youtube, ExternalLink, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// YouTube brand color
const YOUTUBE_RED = '#FF0000';

interface YouTubePlaylistButtonProps {
  escalaId: string;
  onSyncComplete?: () => void;
}

export default function YouTubePlaylistButton({ escalaId, onSyncComplete }: YouTubePlaylistButtonProps) {
  const { isConnected, isLoading, isSyncing, syncPlaylist, getPlaylistInfo, isAdmin } = useYouTube();
  const { toast } = useToast();
  
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);

  useEffect(() => {
    loadPlaylistInfo();
  }, [escalaId]);

  const loadPlaylistInfo = async () => {
    setIsLoadingInfo(true);
    const info = await getPlaylistInfo(escalaId);
    if (info?.youtube_playlist_url) {
      setPlaylistUrl(info.youtube_playlist_url);
    }
    setIsLoadingInfo(false);
  };

  const handleSync = async () => {
    const result = await syncPlaylist(escalaId);
    
    if (result.success) {
      setPlaylistUrl(result.playlistUrl || null);
      
      let description = `${result.videosFound} música(s) encontrada(s) no YouTube.`;
      if (result.videosNotFound && result.videosNotFound.length > 0) {
        description += ` ${result.videosNotFound.length} não encontrada(s): ${result.videosNotFound.slice(0, 3).join(', ')}${result.videosNotFound.length > 3 ? '...' : ''}`;
      }

      toast({
        title: 'Playlist YouTube atualizada!',
        description,
      });

      onSyncComplete?.();
    } else if (result.needsAuth) {
      toast({
        title: 'YouTube não conectado',
        description: 'Conecte sua conta YouTube nas Configurações.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Erro ao sincronizar',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Still loading connection status
  if (isLoading || isLoadingInfo) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">YouTube</span>
      </Button>
    );
  }

  // Not connected - show disabled button with tooltip
  if (!isConnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled
            className="gap-2 opacity-50"
          >
            <Youtube className="h-4 w-4" />
            <span className="hidden sm:inline">YouTube</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Conecte o YouTube nas Configurações para criar playlists</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Connected - show sync button and link
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        className="gap-2"
        style={{ borderColor: playlistUrl ? YOUTUBE_RED : undefined }}
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Youtube className="h-4 w-4" style={{ color: playlistUrl ? YOUTUBE_RED : undefined }} />
        )}
        <span className="hidden sm:inline">
          {playlistUrl ? 'Atualizar' : 'Criar Playlist'}
        </span>
      </Button>
      
      {playlistUrl && (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink className="h-4 w-4" style={{ color: YOUTUBE_RED }} />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>Abrir playlist no YouTube</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
