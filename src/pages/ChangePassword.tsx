import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
    if (!isLoading && user && profile && !profile.must_change_password) {
      navigate('/dashboard');
    }
  }, [user, profile, isLoading, navigate]);

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
        description: 'Confirme a nova senha corretamente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      await refreshUserData();

      toast({
        title: 'Senha atualizada!',
        description: 'Você já pode usar o sistema normalmente.',
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg border-0 animate-slide-up">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-primary shadow-glow">
            <LockKeyhole className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-serif">Crie uma nova senha</CardTitle>
          <CardDescription>
            Sua conta foi criada com a senha temporária Mudar@123. Defina uma senha nova para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
                disabled={isSaving}
              />
            </div>
            <Button type="submit" className="w-full" variant="gradient" size="lg" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
