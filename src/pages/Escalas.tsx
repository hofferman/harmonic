import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, isTomorrow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  Plus,
  ChevronRight,
  Users,
  Music,
  Trash2,
  Search,
  CalendarPlus,
  Clock,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ViewMode = 'proximas' | 'todas' | 'passadas';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }
  return 'Não foi possível concluir a operação.';
};

export default function Escalas() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [novaEscalaData, setNovaEscalaData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [novoSetorId, setNovoSetorId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('proximas');
  const [ministerioFilter, setMinisterioFilter] = useState('todos');
  const [monthFilter, setMonthFilter] = useState('todos');

  const getMinisterioNome = (escala: Pick<Escala, 'setor'>) => escala.setor?.nome || 'Louvor';
  const getEscalaDate = (data: string) => startOfDay(new Date(`${data}T00:00:00`));
  const today = startOfDay(new Date());
  const todayKey = format(today, 'yyyy-MM-dd');

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

  const sortedUpcomingEscalas = useMemo(
    () => escalas.filter((escala) => getEscalaDate(escala.data) >= today),
    [escalas, today],
  );

  const pastEscalas = useMemo(
    () => escalas.filter((escala) => getEscalaDate(escala.data) < today),
    [escalas, today],
  );

  const monthOptions = useMemo(() => {
    const months = new Map<string, string>();
    escalas.forEach((escala) => {
      const date = getEscalaDate(escala.data);
      const key = format(date, 'yyyy-MM');
      months.set(key, format(date, 'MMMM yyyy', { locale: ptBR }));
    });
    return Array.from(months, ([value, label]) => ({ value, label }));
  }, [escalas]);

  const filteredEscalas = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return escalas
      .filter((escala) => {
        const escalaDate = getEscalaDate(escala.data);
        if (viewMode === 'proximas' && escalaDate < today) return false;
        if (viewMode === 'passadas' && escalaDate >= today) return false;
        if (ministerioFilter !== 'todos' && getMinisterioNome(escala) !== ministerioFilter) return false;
        if (monthFilter !== 'todos' && format(escalaDate, 'yyyy-MM') !== monthFilter) return false;

        if (!normalizedSearch) return true;

        const searchable = [
          escala.titulo,
          getMinisterioNome(escala),
          escala.minhaFuncao,
          format(escalaDate, "EEEE d MMMM yyyy", { locale: ptBR }),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      })
      .sort((a, b) => getEscalaDate(a.data).getTime() - getEscalaDate(b.data).getTime());
  }, [escalas, searchTerm, viewMode, ministerioFilter, monthFilter, today]);

  const groupedEscalas = useMemo(() => {
    return filteredEscalas.reduce<Array<{ key: string; label: string; escalas: Escala[] }>>((groups, escala) => {
      const date = getEscalaDate(escala.data);
      const key = format(date, 'yyyy-MM');
      const currentGroup = groups.find((group) => group.key === key);

      if (currentGroup) {
        currentGroup.escalas.push(escala);
        return groups;
      }

      groups.push({
        key,
        label: format(date, 'MMMM yyyy', { locale: ptBR }),
        escalas: [escala],
      });

      return groups;
    }, []);
  }, [filteredEscalas]);

  const ministeriosDisponiveis = useMemo(() => {
    return Array.from(new Set(escalas.map((escala) => getMinisterioNome(escala)))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [escalas]);

  const todayEscalasCount = useMemo(
    () => escalas.filter((escala) => escala.data === todayKey).length,
    [escalas, todayKey],
  );

  const nextEscala = sortedUpcomingEscalas[0];
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
      const baseInsert = {
        data: novaEscalaData,
        titulo: selectedSetor?.nome || 'Louvor',
        created_by: user?.id,
      };
      const canPersistSetorId = UUID_REGEX.test(novoSetorId);

      let createdEscala = null;
      let error = null;

      if (canPersistSetorId) {
        const insertWithSetor = await supabase
          .from('escalas')
          .insert({
            ...baseInsert,
            setor_id: novoSetorId,
          })
          .select('id')
          .single();

        createdEscala = insertWithSetor.data;
        error = insertWithSetor.error;
      }

      const shouldRetryWithoutSetor =
        !canPersistSetorId ||
        error?.message?.includes("column 'setor_id'") ||
        error?.message?.includes('setor_id') ||
        error?.message?.includes('schema cache') ||
        error?.message?.includes('invalid input syntax for type uuid') ||
        error?.message?.includes('violates foreign key constraint') ||
        error?.message?.includes("Could not find the 'setor'");

      if (!createdEscalaId && (!canPersistSetorId || (error && shouldRetryWithoutSetor))) {
        const fallbackInsert = await supabase
          .from('escalas')
          .insert(baseInsert)
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
    } catch (error: unknown) {
      toast({
        title: 'Erro ao criar escala',
        description: getErrorMessage(error),
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
    } catch (error: unknown) {
      setEscalas(previousEscalas);
      writePageCache(`escalas:${user?.id ?? 'anon'}`, previousEscalas);
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(error),
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

  const formatRelativeDate = (data: string) => {
    const date = getEscalaDate(data);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setMinisterioFilter('todos');
    setMonthFilter('todos');
    setViewMode('proximas');
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between animate-fade-in">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-background">
                Agenda
              </Badge>
              {todayEscalasCount > 0 && (
                <Badge className="bg-accent text-accent-foreground">
                  {todayEscalasCount} hoje
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-2xl lg:text-3xl font-serif font-bold text-foreground">
              Escalas
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {isAdmin
                ? 'Crie, encontre e organize as escalas sem precisar caçar datas no calendário.'
                : 'Veja suas próximas escalas em ordem de agenda.'}
            </p>
          </div>

          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient" className="w-full sm:w-auto sm:min-w-[190px]">
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Nova escala
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-serif">Criar nova escala</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nova-escala-data">Data</Label>
                      <Input
                        id="nova-escala-data"
                        type="date"
                        value={novaEscalaData}
                        min={todayKey}
                        onChange={(event) => setNovaEscalaData(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ministério</Label>
                      <Select value={novoSetorId} onValueChange={setNovoSetorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
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
                  </div>
                  <Button
                    className="w-full"
                    variant="gradient"
                    onClick={handleCreateEscala}
                    disabled={isCreating || !novaEscalaData}
                  >
                    {isCreating ? 'Criando...' : 'Criar e abrir escala'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Próximas</p>
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{isLoading ? '-' : sortedUpcomingEscalas.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Hoje</p>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{isLoading ? '-' : todayEscalasCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Ministérios</p>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{isLoading ? '-' : ministeriosDisponiveis.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Histórico</p>
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{isLoading ? '-' : pastEscalas.length}</p>
          </div>
        </div>

        {nextEscala && (
          <button
            type="button"
            className="w-full rounded-lg border bg-primary/10 p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/15 animate-slide-up"
            onClick={() => navigate(`/escalas/${nextEscala.id}`)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Próxima escala</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug break-words">{nextEscala.titulo}</h2>
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                  {formatRelativeDate(nextEscala.data)} · {getMinisterioNome(nextEscala)}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
            </div>
          </button>
        )}

        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="border-b bg-secondary/20 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <CardTitle className="font-serif flex items-center gap-2 text-lg sm:text-xl">
                  <Filter className="h-5 w-5 text-primary" />
                  Agenda de escalas
                </CardTitle>
                <CardDescription className="mt-1">
                  {filteredEscalas.length} escala{filteredEscalas.length !== 1 && 's'} exibida{filteredEscalas.length !== 1 && 's'}.
                </CardDescription>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_160px] lg:min-w-[640px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar escala, ministério ou data"
                    className="pl-9"
                  />
                </div>
                <Select value={ministerioFilter} onValueChange={setMinisterioFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ministério" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos ministérios</SelectItem>
                    {ministeriosDisponiveis.map((ministerio) => (
                      <SelectItem key={ministerio} value={ministerio}>
                        {ministerio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos meses</SelectItem>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        <span className="capitalize">{month.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-3 rounded-lg border bg-background p-1">
                {[
                  { value: 'proximas', label: 'Próximas' },
                  { value: 'todas', label: 'Todas' },
                  { value: 'passadas', label: 'Passadas' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={viewMode === option.value ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 px-2 text-xs sm:px-3 sm:text-sm"
                    onClick={() => setViewMode(option.value as ViewMode)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {(searchTerm || ministerioFilter !== 'todos' || monthFilter !== 'todos' || viewMode !== 'proximas') && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-4 sm:p-5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredEscalas.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma escala encontrada</h3>
                <p className="mx-auto max-w-md text-muted-foreground">
                  {isAdmin
                    ? 'Ajuste os filtros ou crie uma nova escala para o ministério desejado.'
                    : 'Não encontramos escalas com esses filtros.'}
                </p>
                {isAdmin && (
                  <Button variant="gradient" className="mt-5" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova escala
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {groupedEscalas.map((group) => (
                  <section key={group.key} className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground capitalize">
                        {group.label}
                      </h2>
                      <Badge variant="outline">
                        {group.escalas.length}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {group.escalas.map((escala) => (
                        <div
                          key={escala.id}
                          role="button"
                          tabIndex={0}
                          className="group rounded-lg border bg-background p-3 transition hover:border-primary/40 hover:bg-secondary/20 sm:p-4"
                          onClick={() => navigate(`/escalas/${escala.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              navigate(`/escalas/${escala.id}`);
                            }
                          }}
                        >
                          <div className="grid gap-3 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center">
                            <div className="flex items-center gap-3 sm:block sm:text-center">
                              <div className="w-16 rounded-lg border bg-card px-3 py-2 shadow-sm">
                                <p className="text-xs uppercase text-muted-foreground">
                                  {format(getEscalaDate(escala.data), 'MMM', { locale: ptBR })}
                                </p>
                                <p className="text-2xl font-bold leading-none">
                                  {format(getEscalaDate(escala.data), 'd')}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground capitalize sm:mt-2">
                                {format(getEscalaDate(escala.data), 'EEE', { locale: ptBR })}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold leading-snug break-words sm:text-lg">
                                  {escala.titulo}
                                </h3>
                                {getStatusBadge(escala.data)}
                                <Badge variant="secondary">{getMinisterioNome(escala)}</Badge>
                                {escala.minhaFuncao && (
                                  <Badge className="bg-primary/10 text-primary border-0">
                                    {escala.minhaFuncao}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground capitalize">
                                {formatRelativeDate(escala.data)}
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

                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => handleDeleteEscala(escala.id, e)}
                                >
                                  <Trash2 className="w-4 h-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Excluir</span>
                                </Button>
                              )}
                              <ChevronRight className="w-5 h-5 text-muted-foreground transition group-hover:text-primary" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
