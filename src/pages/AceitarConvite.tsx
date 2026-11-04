import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Music2, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ValidationState = 'loading' | 'valid' | 'invalid' | 'error';

interface InvitationInfo {
  nome: string;
  email: string;
}

export default function AceitarConvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const token = searchParams.get('token') || '';
  
  const [validationState, setValidationState] = useState<ValidationState>('loading');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidationState('invalid');
      setInvalidReason('Link de convite inválido.');
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.rpc('validate_invitation', { p_token: token });
      
      if (error) throw error;
      
      const result = data?.[0] || data;
      
      if (result?.is_valid) {
        setValidationState('valid');
        setInvitationInfo({
          nome: result.nome,
          email: result.email,
        });
      } else {
        setValidationState('invalid');
        setInvalidReason(result?.reason || 'Convite inválido.');
      }
    } catch (error) {
      console.error('Error validating invitation:', error);
      setValidationState('error');
      setInvalidReason('Erro ao validar convite. Tente novamente.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'Use pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas diferentes',
        description: 'Confirme a senha corretamente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accept-invitation', {
        body: { token, password },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive',
        });
        
        if (data.code === 'INVALID_INVITATION') {
          // Re-validate to update UI
          validateToken();
        }
        return;
      }

      // If we got a session, set it
      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      toast({
        title: 'Conta criada!',
        description: 'Bem-vindo(a) ao Harmonic!',
      });

      navigate('/escalas');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Erro ao criar conta',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
          {validationState === 'loading' && (
            <CardContent className="py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Validando convite...</p>
            </CardContent>
          )}

          {validationState === 'invalid' && (
            <>
              <CardHeader className="space-y-1 px-4 pb-4 text-center sm:px-6">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="text-xl">Convite inválido</CardTitle>
                <CardDescription>{invalidReason}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  Ir para login
                </Button>
              </CardContent>
            </>
          )}

          {validationState === 'error' && (
            <>
              <CardHeader className="space-y-1 px-4 pb-4 text-center sm:px-6">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="text-xl">Erro</CardTitle>
                <CardDescription>{invalidReason}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={validateToken}
                >
                  Tentar novamente
                </Button>
              </CardContent>
            </>
          )}

          {validationState === 'valid' && invitationInfo && (
            <>
              <CardHeader className="space-y-1 px-4 pb-4 text-center sm:px-6">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">
                  Bem-vindo(a), {invitationInfo.nome}!
                </CardTitle>
                <CardDescription>
                  Crie uma senha para acessar o Harmonic com {invitationInfo.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isSubmitting}
                        className="bg-background/80 pr-12"
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-11 w-11"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Digite a senha novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isSubmitting}
                        className="bg-background/80 pr-12"
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-11 w-11"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    variant="gradient"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar minha conta'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
