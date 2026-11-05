import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSpotify } from '@/hooks/useSpotify';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Music, CheckCircle, XCircle, ExternalLink, Unlink } from 'lucide-react';

// Spotify brand colors
const SPOTIFY_GREEN = '#1DB954';
const SPOTIFY_BLACK = '#191414';

export default function SpotifySettings() {
  const { isConnected, isLoading, startAuth, refreshConnection } = useSpotify();
  const { toast } = useToast();
  
  const [spotifyUserId, setSpotifyUserId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    if (isConnected) {
      loadTokenInfo();
    }
  }, [isConnected]);

  const loadTokenInfo = async () => {
    const { data } = await supabase
      .from('spotify_tokens')
      .select('spotify_user_id, expires_at')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setSpotifyUserId(data.spotify_user_id);
      setExpiresAt(data.expires_at);
    }
  };

  const handleConnect = async () => {
    const result = await startAuth();
    
    if ('authUrl' in result) {
      window.location.href = result.authUrl;
    } else {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar o Spotify? As playlists criadas não serão deletadas.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('spotify_tokens')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast({
        title: 'Spotify desconectado',
        description: 'A conta do Spotify foi desconectada com sucesso.',
      });

      await refreshConnection();
      setSpotifyUserId(null);
      setExpiresAt(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao desconectar Spotify.',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isTokenExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="h-5 w-5" style={{ color: SPOTIFY_GREEN }} />
            Spotify
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="h-5 w-5" style={{ color: SPOTIFY_GREEN }} />
              Spotify
            </CardTitle>
            <CardDescription>
              Gere playlists automaticamente a partir das escalas de louvor.
            </CardDescription>
          </div>
          {isConnected ? (
            <Badge variant="outline" className="gap-1" style={{ borderColor: SPOTIFY_GREEN, color: SPOTIFY_GREEN }}>
              <CheckCircle className="h-3 w-3" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <XCircle className="h-3 w-3" />
              Desconectado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="rounded-lg border bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conta conectada:</span>
                <a
                  href={`https://open.spotify.com/user/${spotifyUserId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-medium hover:underline"
                  style={{ color: SPOTIFY_GREEN }}
                >
                  {spotifyUserId || 'Usuário Spotify'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token válido até:</span>
                  <span className={`text-sm ${isTokenExpired ? 'text-destructive' : 'text-foreground'}`}>
                    {formatExpiryDate(expiresAt)}
                    {isTokenExpired && ' (expirado)'}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="font-medium mb-2">Como funciona:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Ao abrir uma escala de louvor, você pode criar uma playlist no Spotify</li>
                <li>As músicas são buscadas automaticamente pelo nome e artista</li>
                <li>A playlist é atualizada quando você adiciona ou remove músicas</li>
                <li>O nome da playlist segue o formato "Escala DD/MM - Ministério"</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleConnect}
                className="flex-1"
              >
                Reconectar conta
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="font-medium mb-2">Conecte sua conta Spotify para:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Criar playlists automaticamente a partir das escalas</li>
                <li>Compartilhar o repertório com a equipe de louvor</li>
                <li>Manter as playlists sincronizadas com as músicas da escala</li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              className="w-full gap-2"
              style={{ backgroundColor: SPOTIFY_GREEN, color: 'white' }}
            >
              <Music className="h-4 w-4" />
              Conectar com Spotify
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Você será redirecionado para o Spotify para autorizar o acesso.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
