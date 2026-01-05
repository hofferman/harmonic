import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Music, Users, Clock, ChevronRight, AlertCircle, Star } from 'lucide-react';

interface Escala {
  id: string;
  data: string;
  titulo: string;
  created_at: string;
}

interface EscalaMembro {
  id: string;
  funcao_na_escala: string;
  observacao: string | null;
  escala: Escala;
}

interface EscalaMusica {
  id: string;
  ordem: number;
  musica: {
    id: string;
    titulo: string;
    artista: string | null;
    tom: string | null;
  };
}

export default function Dashboard() {
  const { user, profile, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [minhasEscalas, setMinhasEscalas] = useState<EscalaMembro[]>([]);
  const [proximaEscala, setProximaEscala] = useState<EscalaMembro | null>(null);
  const [musicasProximaEscala, setMusicasProximaEscala] = useState<EscalaMusica[]>([]);
  const [totalMembros, setTotalMembros] = useState(0);
  const [totalMusicas, setTotalMusicas] = useState(0);
  const [totalEscalas, setTotalEscalas] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, isAdmin]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Fetch my upcoming schedules
      const { data: escalasData } = await supabase
        .from('escala_membros')
        .select(`
          id,
          funcao_na_escala,
          observacao,
          escala:escalas(id, data, titulo, created_at)
        `)
        .eq('profile_id', user?.id)
        .gte('escala.data', today)
        .order('escala(data)', { ascending: true })
        .limit(5);

      if (escalasData) {
        const filtered = escalasData.filter((e): e is EscalaMembro & { escala: Escala } => 
          e.escala !== null
        );
        setMinhasEscalas(filtered);
        
        if (filtered.length > 0) {
          setProximaEscala(filtered[0]);
          
          // Fetch songs for next schedule
          const { data: musicasData } = await supabase
            .from('escala_musicas')
            .select(`
              id,
              ordem,
              musica:musicas(id, titulo, artista, tom)
            `)
            .eq('escala_id', filtered[0].escala.id)
            .order('ordem', { ascending: true });
          
          if (musicasData) {
            setMusicasProximaEscala(musicasData.filter((m): m is EscalaMusica => m.musica !== null));
          }
        }
      }

      // Admin stats
      if (isAdmin) {
        const { count: membrosCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        setTotalMembros(membrosCount || 0);

        const { count: musicasCount } = await supabase
          .from('musicas')
          .select('*', { count: 'exact', head: true });
        setTotalMusicas(musicasCount || 0);

        const { count: escalasCount } = await supabase
          .from('escalas')
          .select('*', { count: 'exact', head: true })
          .gte('data', today);
        setTotalEscalas(escalasCount || 0);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
            Olá, {profile?.nome?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Gerencie as escalas do ministério' : 'Confira suas próximas escalas'}
          </p>
        </div>

        {/* Admin Stats */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <Card className="bg-gradient-primary text-primary-foreground border-0 shadow-glow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Escalas Ativas</p>
                    <p className="text-3xl font-bold">{isLoading ? '-' : totalEscalas}</p>
                  </div>
                  <Calendar className="w-8 h-8 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Membros</p>
                    <p className="text-3xl font-bold text-foreground">{isLoading ? '-' : totalMembros}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary opacity-60" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Músicas</p>
                    <p className="text-3xl font-bold text-foreground">{isLoading ? '-' : totalMusicas}</p>
                  </div>
                  <Music className="w-8 h-8 text-primary opacity-60" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/escalas')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Nova Escala</p>
                    <p className="text-sm font-medium text-primary">Criar agora →</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <ChevronRight className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Next Schedule */}
          <Card className="animate-slide-up border-0 shadow-lg" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Star className="w-5 h-5 text-accent" />
                Próxima Escala
              </CardTitle>
              <CardDescription>
                {proximaEscala ? formatDate(proximaEscala.escala.data) : 'Nenhuma escala programada'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : proximaEscala ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold">{proximaEscala.escala.titulo}</h3>
                    <Badge variant="secondary" className="mt-2">
                      {proximaEscala.funcao_na_escala}
                    </Badge>
                  </div>
                  
                  {proximaEscala.observacao && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50">
                      <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">{proximaEscala.observacao}</p>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate(`/escalas/${proximaEscala.escala.id}`)}
                  >
                    Ver detalhes
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Você não está escalado para os próximos dias</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Songs for Next Schedule */}
          <Card className="animate-slide-up border-0 shadow-lg" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Music className="w-5 h-5 text-primary" />
                Músicas da Escala
              </CardTitle>
              <CardDescription>
                {musicasProximaEscala.length > 0 
                  ? `${musicasProximaEscala.length} música${musicasProximaEscala.length > 1 ? 's' : ''} no repertório`
                  : 'Nenhuma música definida'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : musicasProximaEscala.length > 0 ? (
                <div className="space-y-2">
                  {musicasProximaEscala.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.musica.titulo}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.musica.artista || 'Artista desconhecido'}
                          {item.musica.tom && ` • Tom: ${item.musica.tom}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma música adicionada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Schedules */}
        {minhasEscalas.length > 1 && (
          <Card className="animate-slide-up border-0 shadow-lg" style={{ animationDelay: '0.4s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Próximas Escalas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {minhasEscalas.slice(1).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/escalas/${item.escala.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-secondary flex flex-col items-center justify-center">
                        <span className="text-xs text-muted-foreground uppercase">
                          {format(new Date(item.escala.data + 'T00:00:00'), 'MMM', { locale: ptBR })}
                        </span>
                        <span className="text-lg font-bold">
                          {format(new Date(item.escala.data + 'T00:00:00'), 'd')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{item.escala.titulo}</p>
                        <p className="text-sm text-muted-foreground">{item.funcao_na_escala}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
