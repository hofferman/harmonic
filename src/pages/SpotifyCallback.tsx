import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSpotify } from '@/hooks/useSpotify';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Music } from 'lucide-react';

export default function SpotifyCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { handleCallback } = useSpotify();
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }

    // Prevent duplicate processing
    if (processedRef.current) return;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setError(errorParam === 'access_denied' 
        ? 'Acesso negado. Você cancelou a autorização.'
        : `Erro do Spotify: ${errorParam}`
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setError('Código de autorização não encontrado.');
      return;
    }

    // Mark as processed before making the call
    processedRef.current = true;

    // Process the callback
    handleCallback(code).then((result) => {
      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setError(result.error || 'Erro desconhecido ao processar autorização.');
      }
    });
  }, [searchParams, user, authLoading, navigate, handleCallback]);

  const handleGoToSettings = () => {
    navigate('/configuracoes');
  };

  const handleGoToEscalas = () => {
    navigate('/escalas');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'processing' && (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Music className="h-5 w-5 text-green-500" />
            Spotify
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'processing' && (
            <>
              <p className="text-muted-foreground">
                Conectando sua conta do Spotify...
              </p>
              <p className="text-sm text-muted-foreground">
                Aguarde enquanto processamos a autorização.
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <p className="text-green-600 dark:text-green-400 font-medium">
                Spotify conectado com sucesso!
              </p>
              <p className="text-sm text-muted-foreground">
                Agora você pode gerar playlists automaticamente para suas escalas.
              </p>
              <div className="flex gap-2 justify-center pt-4">
                <Button variant="outline" onClick={handleGoToSettings}>
                  Configurações
                </Button>
                <Button onClick={handleGoToEscalas}>
                  Ir para Escalas
                </Button>
              </div>
            </>
          )}
          
          {status === 'error' && (
            <>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Erro ao conectar
              </p>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
              <div className="flex gap-2 justify-center pt-4">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Voltar
                </Button>
                <Button onClick={handleGoToSettings}>
                  Tentar Novamente
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
