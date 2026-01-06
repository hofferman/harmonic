import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Music2, Calendar, Users, ArrowRight, Loader2 } from 'lucide-react';

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-warm">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
        <div className="relative max-w-6xl mx-auto px-4 py-16 lg:py-24">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-primary shadow-glow mb-8">
              <Music2 className="w-10 h-10 text-primary-foreground" />
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-serif font-bold text-foreground mb-6">
              <span className="text-gradient">Harmonic</span>
            </h1>
            
            <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Gerencie escalas, músicas e sua equipe de forma simples e organizada. 
              Tudo em um só lugar, acessível de qualquer dispositivo.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="xl"
                variant="gradient"
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto"
              >
                Começar Agora
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 rounded-2xl bg-card shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-semibold mb-2">Escalas Organizadas</h3>
            <p className="text-muted-foreground">
              Crie e gerencie escalas com facilidade. Adicione membros e músicas de forma intuitiva.
            </p>
          </div>
          
          <div className="text-center p-6 rounded-2xl bg-card shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-semibold mb-2">Equipe Conectada</h3>
            <p className="text-muted-foreground">
              Cada membro visualiza suas escalas e repertório. Comunicação simples e direta.
            </p>
          </div>
          
          <div className="text-center p-6 rounded-2xl bg-card shadow-lg animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
              <Music2 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-semibold mb-2">Repertório Completo</h3>
            <p className="text-muted-foreground">
              Cadastre músicas com tom, links e organize o repertório de cada culto.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Music2 className="w-5 h-5 text-primary" />
              <span className="font-serif font-semibold">Harmonic</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Feito com ❤️ para servir a igreja
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
