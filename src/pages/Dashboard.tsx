import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { differenceInCalendarDays, format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  ChevronRight,
  Library,
  Music,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { readPageCache, writePageCache } from '@/lib/pageCache';
import { formatEscalaMembroRole } from '@/lib/escalaFormat';

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
  setor?: { nome: string } | null;
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

interface DashboardCache {
  minhasEscalas: EscalaMembro[];
  proximaEscala: EscalaMembro | null;
  musicasProximaEscala: EscalaMusica[];
  totalMembros: number;
  totalMusicas: number;
  totalEscalas: number;
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
    const cacheKey = `dashboard:${user?.id ?? 'anon'}:${isAdmin ? 'admin' : 'membro'}`;
    const cached = readPageCache<DashboardCache>(cacheKey);

    if (cached) {
      setMinhasEscalas(cached.minhasEscalas);
      setProximaEscala(cached.proximaEscala);
      setMusicasProximaEscala(cached.musicasProximaEscala);
      setTotalMembros(cached.totalMembros);
      setTotalMusicas(cached.totalMusicas);
      setTotalEscalas(cached.totalEscalas);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      let nextMinhasEscalas: EscalaMembro[] = [];
      let nextProximaEscala: EscalaMembro | null = null;
      let nextMusicasProximaEscala: EscalaMusica[] = [];
      let nextTotalMembros = 0;
      let nextTotalMusicas = 0;
      let nextTotalEscalas = 0;
      
      // Fetch my upcoming schedules
      const { data: escalasData } = await supabase
        .from('escala_membros')
        .select(`
          id,
          funcao_na_escala,
          observacao,
          setor:setores(nome),
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
        nextMinhasEscalas = filtered;
        setMinhasEscalas(nextMinhasEscalas);
        
        if (filtered.length > 0) {
          nextProximaEscala = filtered[0];
          setProximaEscala(nextProximaEscala);
          
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
            nextMusicasProximaEscala = musicasData.filter((m): m is EscalaMusica => m.musica !== null);
            setMusicasProximaEscala(nextMusicasProximaEscala);
          }
        } else {
          setProximaEscala(null);
          setMusicasProximaEscala([]);
        }
      }

      // Admin stats
      if (isAdmin) {
        const { count: membrosCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        nextTotalMembros = membrosCount || 0;
        setTotalMembros(nextTotalMembros);

        const { count: musicasCount } = await supabase
          .from('musicas')
          .select('*', { count: 'exact', head: true });
        nextTotalMusicas = musicasCount || 0;
        setTotalMusicas(nextTotalMusicas);

        const { count: escalasCount } = await supabase
          .from('escalas')
          .select('*', { count: 'exact', head: true })
          .gte('data', today);
        nextTotalEscalas = escalasCount || 0;
        setTotalEscalas(nextTotalEscalas);
      }

      writePageCache(cacheKey, {
        minhasEscalas: nextMinhasEscalas,
        proximaEscala: nextProximaEscala,
        musicasProximaEscala: nextMusicasProximaEscala,
        totalMembros: nextTotalMembros,
        totalMusicas: nextTotalMusicas,
        totalEscalas: nextTotalEscalas,
      });
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

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return {
      day: format(date, 'd', { locale: ptBR }),
      month: format(date, 'MMM', { locale: ptBR }),
      weekday: format(date, 'EEEE', { locale: ptBR }),
    };
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const diff = differenceInCalendarDays(date, new Date());
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return `Em ${diff} dias`;
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
      <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:p-4 lg:p-8">
        <section className="animate-fade-in overflow-hidden rounded-2xl border bg-card shadow-lg">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">
                {isAdmin ? 'Painel administrativo' : 'Minha semana'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground lg:text-3xl">
                Olá, {profile?.nome?.split(' ')[0] || 'bem-vindo'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {isAdmin
                  ? 'Acompanhe a operação do ministério e acesse rapidamente as rotinas principais.'
                  : 'Veja sua próxima escala, repertório e próximos compromissos em um só lugar.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <div className="rounded-xl border bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Próximas</p>
                <p className="mt-1 text-2xl font-semibold">{isLoading ? '-' : minhasEscalas.length}</p>
              </div>
              <div className="rounded-xl border bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Repertório</p>
                <p className="mt-1 text-2xl font-semibold">{isLoading ? '-' : musicasProximaEscala.length}</p>
              </div>
              <div className="rounded-xl border bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {proximaEscala ? getDaysUntil(proximaEscala.escala.data) : 'Livre'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {isAdmin && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="shadow-md">
              <CardContent className="flex min-h-[96px] items-center gap-3 p-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Escalas ativas</p>
                  <p className="text-2xl font-semibold">{isLoading ? '-' : totalEscalas}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardContent className="flex min-h-[96px] items-center gap-3 p-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Membros</p>
                  <p className="text-2xl font-semibold">{isLoading ? '-' : totalMembros}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardContent className="flex min-h-[96px] items-center gap-3 p-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Library className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Músicas</p>
                  <p className="text-2xl font-semibold">{isLoading ? '-' : totalMusicas}</p>
                </div>
              </CardContent>
            </Card>
            <button
              type="button"
              onClick={() => navigate('/escalas')}
              className="rounded-xl border bg-primary px-4 py-4 text-left text-primary-foreground shadow-md transition hover:bg-primary/90"
            >
              <div className="flex min-h-[64px] items-center justify-between gap-3">
                <div>
                  <p className="text-xs opacity-80">Ação rápida</p>
                  <p className="mt-1 text-sm font-semibold">Gerenciar escalas</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0" />
              </div>
            </button>
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-secondary/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Star className="h-5 w-5 text-primary" />
                    Próxima escala
                  </CardTitle>
                  <CardDescription>
                    {proximaEscala ? formatDate(proximaEscala.escala.data) : 'Nenhuma escala programada'}
                  </CardDescription>
                </div>
                {proximaEscala && (
                  <Badge className="shrink-0 border-0 bg-primary/10 text-primary">
                    {getDaysUntil(proximaEscala.escala.data)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ) : proximaEscala ? (
                <div className="grid gap-5 lg:grid-cols-[136px_minmax(0,1fr)]">
                  <div className="flex h-32 w-full flex-col items-center justify-center rounded-xl border bg-background lg:h-full">
                    <span className="text-sm capitalize text-muted-foreground">
                      {formatShortDate(proximaEscala.escala.data).month}
                    </span>
                    <span className="text-5xl font-bold leading-none">
                      {formatShortDate(proximaEscala.escala.data).day}
                    </span>
                    <span className="mt-2 text-sm capitalize text-muted-foreground">
                      {formatShortDate(proximaEscala.escala.data).weekday}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div>
                      <h2 className="text-2xl font-semibold leading-tight text-foreground">
                        {proximaEscala.escala.titulo}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {formatEscalaMembroRole(proximaEscala)}
                        </Badge>
                        {proximaEscala.setor?.nome && (
                          <Badge variant="outline">{proximaEscala.setor.nome}</Badge>
                        )}
                      </div>
                    </div>

                    {proximaEscala.observacao && (
                      <div className="flex items-start gap-3 rounded-xl border bg-secondary/20 p-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-sm leading-relaxed text-muted-foreground">{proximaEscala.observacao}</p>
                      </div>
                    )}

                    <Button
                      variant="gradient"
                      className="w-full sm:w-auto"
                      onClick={() => navigate(`/escalas/${proximaEscala.escala.id}`)}
                    >
                      Abrir escala
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed bg-background px-4 py-10 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/40" />
                  <h2 className="mt-4 text-lg font-semibold">Sem escala próxima</h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Quando você for escalado, o compromisso principal aparece aqui com data, função e repertório.
                  </p>
                  <Button variant="outline" className="mt-5" onClick={() => navigate('/escalas')}>
                    Ver escalas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b bg-secondary/20">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Music className="h-5 w-5 text-primary" />
                Repertório
              </CardTitle>
              <CardDescription>
                {musicasProximaEscala.length > 0
                  ? `${musicasProximaEscala.length} música${musicasProximaEscala.length > 1 ? 's' : ''} na próxima escala`
                  : 'Nenhuma música definida'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : musicasProximaEscala.length > 0 ? (
                <div className="space-y-3">
                  {musicasProximaEscala.map((item, index) => (
                    <div key={item.id} className="flex min-h-[68px] items-center gap-3 rounded-xl border bg-background px-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.musica.titulo}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {item.musica.artista || 'Artista não informado'}
                        </p>
                      </div>
                      {item.musica.tom && (
                        <Badge variant="outline" className="shrink-0">
                          {item.musica.tom}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed bg-background px-4 py-10 text-center">
                  <Music className="h-12 w-12 text-muted-foreground/40" />
                  <h2 className="mt-4 text-lg font-semibold">Repertório vazio</h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    As músicas da próxima escala aparecem aqui assim que forem adicionadas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </AppLayout>
  );
}
