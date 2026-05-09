import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ListOrdered, Plus, ChevronRight, Trash2, History, ChevronDown, Calendar, FileText } from 'lucide-react';
import type { OrdemCulto } from '@/types/ordemCulto';
import { clearPageCache, readPageCache, writePageCache } from '@/lib/pageCache';

interface OrdemCultoWithEscala extends OrdemCulto {
  escala_titulo?: string;
}

export default function OrdensCulto() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ordens, setOrdens] = useState<OrdemCultoWithEscala[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchOrdens();
    }
  }, [user]);

  const fetchOrdens = async () => {
    const cacheKey = `ordens-culto:${isAdmin ? 'admin' : 'membro'}`;
    const cached = readPageCache<OrdemCultoWithEscala[]>(cacheKey);

    if (cached) {
      setOrdens(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('ordens_culto')
        .select(`
          *,
          escala:escalas(titulo)
        `)
        .order('data', { ascending: true });

      if (error) throw error;

      if (data) {
        const mapped: OrdemCultoWithEscala[] = data.map((item: any) => ({
          ...item,
          escala_titulo: item.escala?.titulo,
        }));
        setOrdens(mapped);
        writePageCache(cacheKey, mapped);
      }
    } catch (error) {
      console.error('Error fetching ordens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta ordem de culto?')) return;

    try {
      const { error } = await supabase.from('ordens_culto').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Ordem excluída',
        description: 'A ordem de culto foi removida com sucesso.',
      });
      clearPageCache();
      fetchOrdens();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const today = startOfDay(new Date());
  const futureOrdens = ordens.filter(o => {
    const d = startOfDay(new Date(o.data + 'T00:00:00'));
    return d >= today;
  });
  const pastOrdens = ordens.filter(o => {
    const d = startOfDay(new Date(o.data + 'T00:00:00'));
    return d < today;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'publicada') {
      return <Badge className="bg-green-500/10 text-green-600 border-0">Publicada</Badge>;
    }
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  const renderCard = (ordem: OrdemCultoWithEscala, index: number) => (
    <Card
      key={ordem.id}
      className="border-0 shadow-md hover:shadow-lg cursor-pointer transition-all animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={() => navigate(`/ordens-culto/${ordem.id}`)}
    >
      <CardContent className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
              <span className="text-[11px] sm:text-xs text-muted-foreground uppercase">
                {format(new Date(ordem.data + 'T00:00:00'), 'MMM', { locale: ptBR })}
              </span>
              <span className="text-lg sm:text-xl font-bold">
                {format(new Date(ordem.data + 'T00:00:00'), 'd')}
              </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base sm:text-lg leading-snug break-words">{ordem.titulo}</h3>
                {getStatusBadge(ordem.status)}
              </div>
                <p className="text-sm text-muted-foreground mt-1 capitalize leading-snug">
                {formatDate(ordem.data)}
              </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {ordem.escala_titulo && (
                <span className="flex items-center gap-1 min-w-0">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="truncate">Escala: {ordem.escala_titulo}</span>
                </span>
              )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => handleDelete(ordem.id, e)}
              >
                <Trash2 className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Excluir</span>
              </Button>
            )}
          </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="px-3 py-4 sm:p-4 lg:p-8 space-y-5 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
              Ordem de Culto
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? 'Monte a ordem completa do culto' : 'Ordens de culto publicadas'}
            </p>
          </div>

          {isAdmin && (
            <Button variant="gradient" className="w-full sm:w-auto" onClick={() => navigate('/ordens-culto/nova')}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Ordem
            </Button>
          )}
        </div>

        {/* List */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </>
          ) : futureOrdens.length === 0 && !showPast ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <ListOrdered className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma ordem de culto futura</h3>
                <p className="text-muted-foreground">
                  {isAdmin
                    ? 'Clique em "Nova Ordem" para criar a primeira ordem de culto.'
                    : 'Nenhuma ordem de culto publicada para os próximos dias.'}
                </p>
                {pastOrdens.length > 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowPast(true)}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Ver {pastOrdens.length} ordem{pastOrdens.length !== 1 && 'ns'} anterior{pastOrdens.length !== 1 && 'es'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {futureOrdens.map((ordem, index) => renderCard(ordem, index))}

              {pastOrdens.length > 0 && (
                <div className="mt-8">
                  <Button
                    variant="ghost"
                    className="w-full justify-between mb-4 text-muted-foreground h-auto py-3 text-left"
                    onClick={() => setShowPast(!showPast)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <History className="w-4 h-4 shrink-0" />
                      <span className="truncate">Ordens anteriores ({pastOrdens.length})</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${showPast ? 'rotate-180' : ''}`} />
                  </Button>

                  {showPast && (
                    <div className="space-y-4 opacity-70">
                      {pastOrdens.map((ordem, index) => renderCard(ordem, index))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
