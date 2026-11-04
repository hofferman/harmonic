import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Music2, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { user, profile, signIn } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    if (user && profile) {
      navigate(profile.must_change_password ? '/change-password' : '/escalas');
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      let message = error.message;
      if (error.message === 'Invalid login credentials') {
        message = 'Email ou senha incorretos';
      }
      if (error.message === 'Email not confirmed') {
        message = 'Email não confirmado. Entre em contato com um administrador.';
      }
      toast({
        title: 'Erro ao entrar',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso.',
      });
    }
    
    setIsLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!loginEmail.trim()) {
      toast({
        title: 'Informe seu email',
        description: 'Digite seu email acima e toque novamente em "Esqueci minha senha".',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/change-password`,
    });
    setIsLoading(false);

    toast(error
      ? { title: 'Não foi possível enviar o link', description: error.message, variant: 'destructive' }
      : { title: 'Confira seu email', description: 'Enviamos um link para criar uma nova senha.' },
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-warm px-3 py-6 sm:p-4">
      <div className="absolute inset-x-0 top-0 h-56 bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 bg-primary/5 blur-3xl" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow sm:h-16 sm:w-16">
            <Music2 className="h-7 w-7 text-primary-foreground sm:h-8 sm:w-8" />
          </div>
          <h1 className="text-3xl font-bold leading-tight text-foreground">
            Harmonic
          </h1>
          <p className="mt-2 text-muted-foreground">
            Gestão de escalas e músicas
          </p>
        </div>

        <Card className="border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-1 px-4 pb-4 text-center sm:px-6">
            <CardTitle className="text-2xl leading-tight">
              Acesse sua conta
            </CardTitle>
            <CardDescription>
              Entre com seu email e senha
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-background/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-background/80 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showLoginPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <Button type="button" variant="link" className="-mt-2 h-auto px-0 text-base" onClick={handlePasswordReset} disabled={isLoading}>
                Esqueci minha senha
              </Button>
              <Button
                type="submit"
                className="w-full"
                variant="gradient"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
              <p>
                Não tem uma conta? Fale com um administrador para receber um convite.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
