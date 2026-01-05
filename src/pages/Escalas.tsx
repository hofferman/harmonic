import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isFuture, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Plus, ChevronRight, Users, Music, Trash2 } from 'lucide-react';

interface Escala {
  id: string;
  data: string;
  titulo: string;
  created_at: string;
  created_by: string;
  membros_count?: number;
  musicas_count?: number;
  minhaFuncao?: string;
}

export default function Escalas() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [novaEscalaData, setNovaEscalaData] = useState('');
  const [novaEscalaTitulo, setNovaEscalaTitulo] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEscalas();
    }
  }, [user]);

  const fetchEscalas = async () => {
    setIsLoading(true);
    try {
      // Fetch escalas with member and music counts
      const { data: escalasData, error } = await supabase
        .from('escalas')
        .select(`
          id,
          data,
          titulo,
          created_at,
          created_by
        `)
        .order('data', { ascending: true });

      if (error) throw error;

      if (escalasData) {
        // Get counts for each escala
        const escalasWithCounts = await Promise.all(
          escalasData.map(async (escala) => {
            const { count: membrosCount } = await supabase
              .from('escala_membros')
              .select('*', { count: 'exact', head: true })
              .eq('escala_id', escala.id);

            const { count: musicasCount } = await supabase
              .from('escala_musicas')
              .select('*', { count: 'exact', head: true })
              .eq('escala_id', escala.id);

            // Check if current user is in this escala
            const { data: meuMembro } = await supabase
              .from('escala_membros')
              .select('funcao_na_escala')
              .eq('escala_id', escala.id)
              .eq('profile_id', user?.id)
              .maybeSingle();

            return {
              ...escala,
              membros_count: membrosCount || 0,
              musicas_count: musicasCount || 0,
              minhaFuncao: meuMembro?.funcao_na_escala,
            };
          })
        );

        setEscalas(escalasWithCounts);
      }
    } catch (error) {
      console.error('Error fetching escalas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEscala = async () => {
    if (!novaEscalaData || !novaEscalaTitulo.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('escalas').insert({
        data: novaEscalaData,
        titulo: novaEscalaTitulo.trim(),
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: 'Escala criada!',
        description: 'A nova escala foi criada com sucesso.',
      });

      setIsDialogOpen(false);
      setNovaEscalaData('');
      setNovaEscalaTitulo('');
      fetchEscalas();
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

    try {
      const { error } = await supabase.from('escalas').delete().eq('id', escalaId);
      if (error) throw error;

      toast({
        title: 'Escala excluída',
        description: 'A escala foi removida com sucesso.',
      });

      fetchEscalas();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (data: string) => {
    const date = new Date(data + 'T00:00:00');
    if (isToday(date)) {
      return <Badge className="bg-accent text-accent-foreground">Hoje</Badge>;
    }
    if (isPast(date)) {
      return <Badge variant="secondary">Passada</Badge>;
    }
    return <Badge variant="outline">Futura</Badge>;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
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
      <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
              Escalas
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? 'Gerencie as escalas do ministério' : 'Suas escalas'}
            </p>
          </div>
          
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Escala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">Criar Nova Escala</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="titulo">Título</Label>
                    <Input
                      id="titulo"
                      placeholder="Ex: Culto Domingo Noite"
                      value={novaEscalaTitulo}
                      onChange={(e) => setNovaEscalaTitulo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data">Data</Label>
                    <Input
                      id="data"
                      type="date"
                      value={novaEscalaData}
                      onChange={(e) => setNovaEscalaData(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    variant="gradient"
                    onClick={handleCreateEscala}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Criando...' : 'Criar Escala'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Escalas List */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </>
          ) : escalas.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma escala encontrada</h3>
                <p className="text-muted-foreground">
                  {isAdmin 
                    ? 'Clique em "Nova Escala" para criar a primeira escala.'
                    : 'Você ainda não foi escalado.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            escalas.map((escala, index) => (
              <Card
                key={escala.id}
                className="border-0 shadow-md hover:shadow-lg cursor-pointer transition-all animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(`/escalas/${escala.id}`)}
              >
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs text-muted-foreground uppercase">
                          {format(new Date(escala.data + 'T00:00:00'), 'MMM', { locale: ptBR })}
                        </span>
                        <span className="text-xl font-bold">
                          {format(new Date(escala.data + 'T00:00:00'), 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{escala.titulo}</h3>
                          {getStatusBadge(escala.data)}
                          {escala.minhaFuncao && (
                            <Badge className="bg-primary/10 text-primary border-0">
                              {escala.minhaFuncao}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 capitalize">
                          {formatDate(escala.data)}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteEscala(escala.id, e)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
