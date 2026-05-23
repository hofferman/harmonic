import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Plus, ChevronRight, Users, Music, Trash2, ChevronDown } from 'lucide-react';
import { clearPageCache, readPageCache, writePageCache } from '@/lib/pageCache';
import { formatEscalaMembroRole } from '@/lib/escalaFormat';

interface Setor {
  id: string;
  nome: string;
}

const MINISTERIOS_FALLBACK: Setor[] = [
  { id: 'louvor', nome: 'Louvor' },
  { id: 'farol', nome: 'Farol' },
  { id: 'acesso', nome: 'Acesso' },
];

interface Escala {
  id: string;
  data: string;
  titulo: string;
  created_at: string;
  created_by: string;
  setor: Setor | null;
  membros_count?: number;
  musicas_count?: number;
  minhaFuncao?: string;
}

export default function Escalas() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [novoSetorId, setNovoSetorId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const getMinisterioNome = (escala: Pick<Escala, 'setor'>) => escala.setor?.nome || 'Louvor';
  const formatLongDate = (date: Date) =>
    format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEscalas();
      fetchSetores();
    }
  }, [user]);

  const fetchSetores = async () => {
    const { data, error } = await supabase.from('setores').select('id, nome').order('nome');
    if (error) {
      setSetores(MINISTERIOS_FALLBACK);
      return;
    }
    if (data) setSetores(data);
  };

  const fetchEscalas = async () => {
    const cacheKey = `escalas:${user?.id ?? 'anon'}`;
    const cached = readPageCache<Escala[]>(cacheKey);

    if (cached) {
      setEscalas(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      let { data: escalasData, error } = await supabase
        .from('escalas')
        .select(`
          id,
          data,
          titulo,
          created_at,
          created_by,
          setor:setores(id, nome)
        `)
        .order('data', { ascending: true });

      if (error) {
        const fallback = await supabase
          .from('escalas')
          .select(`
            id,
            data,
            titulo,
            created_at,
            created_by
          `)
          .order('data', { ascending: true });

        escalasData = fallback.data?.map((escala) => ({
          ...escala,
          setor: null,
        })) as Escala[] | null;
        error = fallback.error;
      }

      if (error) throw error;

      if (escalasData) {
        const escalasWithCounts = await Promise.all(
          escalasData
            .map(async (escala) => {
              const { count: membrosCount } = await supabase
                .from('escala_membros')
                .select('*', { count: 'exact', head: true })
                .eq('escala_id', escala.id);

              const { count: musicasCount } = await supabase
                .from('escala_musicas')
                .select('*', { count: 'exact', head: true })
                .eq('escala_id', escala.id);

              let { data: meuMembro } = await supabase
                .from('escala_membros')
                .select('funcao_na_escala, setor:setores(nome)')
                .eq('escala_id', escala.id)
                .eq('profile_id', user?.id)
                .maybeSingle();

              if (!meuMembro) {
                const fallbackMembro = await supabase
                  .from('escala_membros')
                  .select('funcao_na_escala')
                  .eq('escala_id', escala.id)
                  .eq('profile_id', user?.id)
                  .maybeSingle();

                meuMembro = fallbackMembro.data as typeof meuMembro;
              }

              return {
                ...escala,
                membros_count: membrosCount || 0,
                musicas_count: musicasCount || 0,
                minhaFuncao: meuMembro ? formatEscalaMembroRole(meuMembro) : undefined,
              };
            }),
        );

        setEscalas(escalasWithCounts);
        writePageCache(cacheKey, escalasWithCounts);
      }
    } catch (error) {
      console.error('Error fetching escalas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateShort = format(selectedDate, "d 'de' MMM", { locale: ptBR });

  const sortedUpcomingEscalas = useMemo(
    () => escalas.filter((escala) => startOfDay(new Date(`${escala.data}T00:00:00`)) >= startOfDay(new Date())),
    [escalas],
  );
  const selectedSetor = setores.find((setor) => setor.id === novoSetorId) || null;

  const handleCreateEscala = async () => {
    if (!novoSetorId) {
      toast({
        title: 'Erro',
        description: 'Selecione o ministério da escala.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      let createdEscalaId: string | null = null;

      let { data: createdEscala, error } = await supabase
        .from('escalas')
        .insert({
          data: selectedDateKey,
          titulo: selectedSetor?.nome || 'Louvor',
          created_by: user?.id,
          setor_id: novoSetorId,
        })
        .select('id')
        .single();

      const missingSetorColumn =
        error?.message?.includes("column 'setor_id'") ||
        error?.message?.includes('setor_id') ||
        error?.message?.includes('schema cache');

      if (error && missingSetorColumn) {
        const fallbackInsert = await supabase
          .from('escalas')
          .insert({
            data: selectedDateKey,
            titulo: selectedSetor?.nome || 'Louvor',
            created_by: user?.id,
          })
          .select('id')
          .single();

        createdEscala = fallbackInsert.data;
        error = fallbackInsert.error;
      }

      if (error) throw error;

      createdEscalaId = createdEscala?.id ?? null;

      toast({
        title: 'Escala criada!',
        description: 'A nova escala foi criada com sucesso.',
      });

      setIsDialogOpen(false);
      setNovoSetorId('');
      clearPageCache();
      await fetchEscalas();

      if (createdEscalaId) {
        navigate(`/escalas/${createdEscalaId}`);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao criar escala',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEscala = async (escalaId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;

    const previousEscalas = escalas;
    const nextEscalas = escalas.filter((escala) => escala.id !== escalaId);

    setEscalas(nextEscalas);
    writePageCache(`escalas:${user?.id ?? 'anon'}`, nextEscalas);

    try {
      const { error } = await supabase.from('escalas').delete().eq('id', escalaId);
      if (error) throw error;

      toast({
        title: 'Escala excluída',
        description: 'A escala foi removida com sucesso.',
      });
    } catch (error: any) {
      setEscalas(previousEscalas);
      writePageCache(`escalas:${user?.id ?? 'anon'}`, previousEscalas);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (data: string) => {
    const date = new Date(`${data}T00:00:00`);
    if (isToday(date)) {
      return <Badge className="bg-accent text-accent-foreground">Hoje</Badge>;
    }
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="secondary">Passada</Badge>;
    }
    return <Badge variant="outline">Futura</Badge>;
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
      <div className="px-3 py-4 sm:p-4 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
              Escalas
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {isAdmin ? 'Escolha um dia no calendário para criar escalas por ministério' : 'Acompanhe as próximas escalas'}
            </p>
          </div>

          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient" className="w-full sm:min-w-[220px] sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova escala do dia
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-serif">Criar escala em {format(selectedDate, 'dd/MM/yyyy')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Ministério</Label>
                    <Select value={novoSetorId} onValueChange={setNovoSetorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um ministério..." />
                      </SelectTrigger>
                      <SelectContent>
                        {setores.map((setor) => (
                          <SelectItem key={setor.id} value={setor.id}>
                            {setor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    variant="gradient"
                    onClick={handleCreateEscala}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Criando...' : 'Criar escala'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
          <div className="space-y-4 xl:sticky xl:top-20">
            <Card className="border-0 shadow-lg animate-slide-up overflow-hidden">
              <div className="px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Data selecionada</p>
                    <h2 className="mt-2 text-xl font-serif font-semibold capitalize sm:text-2xl">{selectedDateShort}</h2>
                    <p className="mt-1 text-sm text-muted-foreground capitalize leading-relaxed">{formatLongDate(selectedDate)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 justify-between sm:w-auto"
                    onClick={() => setIsCalendarExpanded((current) => !current)}
                  >
                    Calendário
                    <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isCalendarExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </div>
              </div>
              <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                <div className={isCalendarExpanded ? 'block' : 'hidden'}>
                  <DateCalendar
                    mode="single"
                    locale={ptBR}
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                    modifiers={{
                      selectedFocus: [selectedDate],
                      hasEscala: escalas.map((escala) => new Date(`${escala.data}T00:00:00`)),
                    }}
                    modifiersClassNames={{
                      hasEscala: 'relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary',
                    }}
                    className="mx-auto w-full rounded-xl border bg-background p-2 sm:w-fit"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="border-b bg-secondary/20 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="font-serif flex items-center gap-2 text-lg sm:text-xl">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Próximas escalas
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Acompanhe as agendas já criadas.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="h-8 px-3">
                      {sortedUpcomingEscalas.length} agenda{sortedUpcomingEscalas.length !== 1 && 's'}
                    </Badge>
                    {isAdmin && (
                      <Button variant="gradient" className="w-full sm:w-auto lg:hidden" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova escala
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-5">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                  ))}
                </>
              ) : sortedUpcomingEscalas.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-secondary/20 py-14 px-5 text-center">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma próxima escala</h3>
                  <p className="text-muted-foreground">
                    {isAdmin
                      ? 'Crie uma nova escala para um ministério.'
                      : 'Você não possui próximas escalas.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedUpcomingEscalas.map((escala) => (
                  <Card
                    key={escala.id}
                    className="border shadow-sm hover:shadow-md hover:border-primary/30 cursor-pointer transition-all"
                    onClick={() => navigate(`/escalas/${escala.id}`)}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <CalendarDays className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base sm:text-lg leading-snug break-words">{escala.titulo}</h3>
                            {getStatusBadge(escala.data)}
                            <Badge variant="secondary">{getMinisterioNome(escala)}</Badge>
                            {escala.minhaFuncao && (
                              <Badge className="bg-primary/10 text-primary border-0">
                                {escala.minhaFuncao}
                              </Badge>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-muted-foreground capitalize">
                            {format(new Date(`${escala.data}T00:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {escala.membros_count} membro{escala.membros_count !== 1 && 's'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Music className="w-4 h-4" />
                              {escala.musicas_count} música{escala.musicas_count !== 1 && 's'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0 self-start sm:self-center">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => handleDeleteEscala(escala.id, e)}
                            >
                              <Trash2 className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Excluir</span>
                            </Button>
                          )}
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}

              {!isLoading && sortedUpcomingEscalas.length > 0 && (
                <div className="rounded-xl bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                  {sortedUpcomingEscalas.length} escala{sortedUpcomingEscalas.length !== 1 && 's'} encontrada{sortedUpcomingEscalas.length !== 1 && 's'}.
                </div>
              )}
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
