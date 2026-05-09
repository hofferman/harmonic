import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, Calendar, Users, Music, Plus, Trash2, 
  ChevronUp, ChevronDown, ExternalLink, Star, FileText, X, Edit2, ChevronsUpDown, Check
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Profile {
  id: string;
  nome: string;
}

interface EscalaMembro {
  id: string;
  profile_id: string;
  funcao_na_escala: string;
  observacao: string | null;
  profile: Profile;
}

interface EscalaMusica {
  id: string;
  ordem: number;
  ministro_id: string | null;
  ministro: Profile | null;
  musica: {
    id: string;
    titulo: string;
    artista: string | null;
    tom: string | null;
    link: string | null;
    letra: string | null;
  };
}

interface Escala {
  id: string;
  data: string;
  titulo: string;
  created_at: string;
  created_by: string;
}

interface MusicaOption {
  id: string;
  titulo: string;
  artista: string | null;
  ultimaVezTocada: string | null;
  ultimoMinistro: string | null;
}

const FUNCOES = [
  'Vocal Principal',
  'Backing Vocal',
  'Violão',
  'Guitarra',
  'Baixo',
  'Teclado',
  'Bateria',
  'Percussão',
  'Saxofone',
  'Técnico de Som',
];

export default function EscalaDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [escala, setEscala] = useState<Escala | null>(null);
  const [membros, setMembros] = useState<EscalaMembro[]>([]);
  const [musicas, setMusicas] = useState<EscalaMusica[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allMusicas, setAllMusicas] = useState<MusicaOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add member dialog
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedFuncao, setSelectedFuncao] = useState('');
  const [observacao, setObservacao] = useState('');

  // Add music dialog
  const [isAddMusicOpen, setIsAddMusicOpen] = useState(false);
  const [selectedMusica, setSelectedMusica] = useState('');
  const [selectedMinistro, setSelectedMinistro] = useState('');

  // View letra dialog
  const [isLetraDialogOpen, setIsLetraDialogOpen] = useState(false);
  const [viewingMusica, setViewingMusica] = useState<EscalaMusica['musica'] | null>(null);

  // Edit music dialog
  const [isEditMusicOpen, setIsEditMusicOpen] = useState(false);
  const [editingEscalaMusica, setEditingEscalaMusica] = useState<EscalaMusica | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editArtista, setEditArtista] = useState('');
  const [editTom, setEditTom] = useState('');
  const [editLink, setEditLink] = useState('');
  const [isEditingSaving, setIsEditingSaving] = useState(false);
  const [artistaPopoverOpen, setArtistaPopoverOpen] = useState(false);

  // Edit letra dialog
  const [isEditLetraOpen, setIsEditLetraOpen] = useState(false);
  const [editingLetraMusica, setEditingLetraMusica] = useState<EscalaMusica['musica'] | null>(null);
  const [editLetra, setEditLetra] = useState('');
  const [isEditLeiraSaving, setIsEditLeiraSaving] = useState(false);

  const openLetraDialog = (musica: EscalaMusica['musica']) => {
    setViewingMusica(musica);
    setIsLetraDialogOpen(true);
  };

  const openEditMusicDialog = (escalaMusica: EscalaMusica) => {
    setEditingEscalaMusica(escalaMusica);
    setEditTitulo(escalaMusica.musica.titulo);
    setEditArtista(escalaMusica.musica.artista || '');
    setEditTom(escalaMusica.musica.tom || '');
    setEditLink(escalaMusica.musica.link || '');
    setIsEditMusicOpen(true);
  };

  const openEditLetraDialog = (musica: EscalaMusica['musica']) => {
    setEditingLetraMusica(musica);
    setEditLetra(musica.letra || '');
    setIsEditLetraOpen(true);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchEscalaData();
      if (isAdmin) {
        fetchAllProfiles();
        fetchAllMusicas();
      }
    }
  }, [id, user, isAdmin]);

  const fetchEscalaData = async () => {
    setIsLoading(true);
    try {
      // Fetch escala
      const { data: escalaData, error: escalaError } = await supabase
        .from('escalas')
        .select('*')
        .eq('id', id)
        .single();

      if (escalaError) throw escalaError;
      setEscala(escalaData);

      // Fetch members
      const { data: membrosData } = await supabase
        .from('escala_membros')
        .select(`
          id,
          profile_id,
          funcao_na_escala,
          observacao,
          profile:profiles(id, nome)
        `)
        .eq('escala_id', id)
        .order('funcao_na_escala');

      if (membrosData) {
        setMembros(membrosData.filter((m): m is EscalaMembro => m.profile !== null));
      }

      // Fetch musicas
      const { data: musicasData } = await supabase
        .from('escala_musicas')
        .select(`
          id,
          ordem,
          ministro_id,
          ministro:profiles!escala_musicas_ministro_id_fkey(id, nome),
          musica:musicas(id, titulo, artista, tom, link, letra)
        `)
        .eq('escala_id', id)
        .order('ordem');

      if (musicasData) {
        setMusicas(musicasData.filter((m): m is EscalaMusica => m.musica !== null));
      }
    } catch (error: any) {
      console.error('Error fetching escala:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a escala.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, nome').order('nome');
    if (data) setAllProfiles(data);
  };

  const fetchAllMusicas = async () => {
    const { data: musicasData } = await supabase
      .from('musicas')
      .select('id, titulo, artista')
      .order('titulo');
    
    if (musicasData) {
      // For each music, find the last time it was played and who ministered
      const musicasWithLastPlayed = await Promise.all(
        musicasData.map(async (musica) => {
          const { data: lastEscala } = await supabase
            .from('escala_musicas')
            .select(`
              escala:escalas(data),
              ministro:profiles!escala_musicas_ministro_id_fkey(nome)
            `)
            .eq('musica_id', musica.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          return {
            ...musica,
            ultimaVezTocada: lastEscala?.escala?.data || null,
            ultimoMinistro: lastEscala?.ministro?.nome || null,
          };
        })
      );
      setAllMusicas(musicasWithLastPlayed);
    }
  };

  const handleAddMember = async () => {
    if (!selectedProfile || !selectedFuncao) {
      toast({
        title: 'Erro',
        description: 'Selecione o membro e a função.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('escala_membros').insert({
        escala_id: id,
        profile_id: selectedProfile,
        funcao_na_escala: selectedFuncao,
        observacao: observacao || null,
      });

      if (error) throw error;

      toast({ title: 'Membro adicionado!' });
      setIsAddMemberOpen(false);
      setSelectedProfile('');
      setSelectedFuncao('');
      setObservacao('');
      fetchEscalaData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (membroId: string) => {
    if (!confirm('Remover este membro da escala?')) return;

    try {
      const { error } = await supabase.from('escala_membros').delete().eq('id', membroId);
      if (error) throw error;

      toast({ title: 'Membro removido' });
      fetchEscalaData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddMusic = async () => {
    if (!selectedMusica) {
      toast({
        title: 'Erro',
        description: 'Selecione uma música.',
        variant: 'destructive',
      });
      return;
    }

    // Check if music is already in the repertoire
    const alreadyExists = musicas.some(m => m.musica.id === selectedMusica);
    if (alreadyExists) {
      toast({
        title: 'Música já adicionada',
        description: 'Esta música já está no repertório desta escala.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('escala_musicas').insert({
        escala_id: id,
        musica_id: selectedMusica,
        ordem: musicas.length,
        ministro_id: selectedMinistro || null,
      });

      if (error) throw error;

      toast({ title: 'Música adicionada!' });
      setIsAddMusicOpen(false);
      setSelectedMusica('');
      setSelectedMinistro('');
      fetchEscalaData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMusic = async (escalaMusica: string) => {
    if (!confirm('Remover esta música da escala?')) return;

    try {
      const { error } = await supabase.from('escala_musicas').delete().eq('id', escalaMusica);
      if (error) throw error;

      toast({ title: 'Música removida' });
      fetchEscalaData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMoveMusic = async (escalaMusica: EscalaMusica, direction: 'up' | 'down') => {
    const currentIndex = musicas.findIndex(m => m.id === escalaMusica.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= musicas.length) return;
    
    const otherMusica = musicas[newIndex];
    const previousMusicas = [...musicas];
    const reorderedMusicas = [...musicas];
    reorderedMusicas[currentIndex] = { ...otherMusica, ordem: currentIndex };
    reorderedMusicas[newIndex] = { ...escalaMusica, ordem: newIndex };
    setMusicas(reorderedMusicas);
    
    try {
      const [firstUpdate, secondUpdate] = await Promise.all([
        supabase
          .from('escala_musicas')
          .update({ ordem: newIndex })
          .eq('id', escalaMusica.id),
        supabase
          .from('escala_musicas')
          .update({ ordem: currentIndex })
          .eq('id', otherMusica.id),
      ]);

      if (firstUpdate.error) throw firstUpdate.error;
      if (secondUpdate.error) throw secondUpdate.error;
    } catch (error: any) {
      setMusicas(previousMusicas);
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEditMusic = async () => {
    if (!editTitulo.trim()) {
      toast({
        title: 'Erro',
        description: 'O título é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    if (!editingEscalaMusica) return;

    setIsEditingSaving(true);
    try {
      const musicaData = {
        titulo: editTitulo.trim(),
        artista: editArtista.trim() || null,
        tom: editTom.trim() || null,
        link: editLink.trim() || null,
      };

      const { error } = await supabase
        .from('musicas')
        .update(musicaData)
        .eq('id', editingEscalaMusica.musica.id);

      if (error) throw error;
      
      toast({ title: 'Música atualizada!' });
      setIsEditMusicOpen(false);
      fetchEscalaData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleEditLetra = async () => {
    if (!editingLetraMusica) return;

    setIsEditLeiraSaving(true);
    try {
      const { error } = await supabase
        .from('musicas')
        .update({ letra: editLetra.trim() || null })
        .eq('id', editingLetraMusica.id);

      if (error) throw error;
      
      toast({ title: 'Letra/cifra salva!' });
      setIsEditLetraOpen(false);
      fetchEscalaData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsEditLeiraSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (!escala) return null;
    const date = new Date(escala.data + 'T00:00:00');
    if (isToday(date)) {
      return <Badge className="bg-accent text-accent-foreground">Hoje</Badge>;
    }
    if (isPast(date)) {
      return <Badge variant="secondary">Passada</Badge>;
    }
    return <Badge variant="outline">Futura</Badge>;
  };

  const isCurrentUserMember = membros.some(m => m.profile_id === user?.id);
  const currentUserFuncao = membros.find(m => m.profile_id === user?.id)?.funcao_na_escala;

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="px-3 py-4 sm:p-4 lg:p-8 space-y-5 sm:space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!escala) {
    return (
      <AppLayout>
      <div className="px-3 py-4 sm:p-4 lg:p-8 text-center">
          <p>Escala não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/escalas')}>
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4 sm:p-4 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="animate-fade-in">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate('/escalas')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-serif font-bold leading-tight break-words">
                  {escala.titulo}
                </h1>
                {getStatusBadge()}
              </div>
              <p className="text-muted-foreground mt-1 flex items-start gap-2 leading-snug">
                <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{format(new Date(escala.data + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </p>
            </div>

            {isCurrentUserMember && (
              <Badge className="bg-primary text-primary-foreground w-fit shrink-0">
                <Star className="w-3 h-3 mr-1" />
                {currentUserFuncao}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] items-start">
          {/* Songs */}
          <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 sm:px-6">
              <CardTitle className="font-serif flex min-w-0 items-center gap-2 text-xl leading-tight">
                <Music className="w-5 h-5 text-primary" />
                Repertório ({musicas.length})
              </CardTitle>
              {isAdmin && (
                <Dialog open={isAddMusicOpen} onOpenChange={setIsAddMusicOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-serif">Adicionar Música</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Música</Label>
                        <Select value={selectedMusica} onValueChange={setSelectedMusica}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allMusicas.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                <div className="flex flex-col">
                                  <span>{m.titulo} {m.artista && `- ${m.artista}`}</span>
                                  {(m.ultimaVezTocada || m.ultimoMinistro) && (
                                    <span className="text-xs text-muted-foreground">
                                      {m.ultimaVezTocada && `Tocada em ${format(new Date(m.ultimaVezTocada + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}`}
                                      {m.ultimaVezTocada && m.ultimoMinistro && ' • '}
                                      {m.ultimoMinistro && `Último ministro: ${m.ultimoMinistro}`}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ministro (opcional)</Label>
                        <Select value={selectedMinistro} onValueChange={setSelectedMinistro}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione quem vai ministrar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allProfiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Não encontrou? <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/musicas')}>
                          Cadastre uma nova música
                        </Button>
                      </p>
                      <Button className="w-full" variant="gradient" onClick={handleAddMusic}>
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {musicas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma música no repertório</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {musicas.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group border border-secondary/20 p-3 sm:p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-base leading-snug break-words">{item.musica.titulo}</p>
                              {item.musica.letra && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  Cifra
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            {item.musica.artista && (
                              <span><span className="font-medium">Artista:</span> {item.musica.artista}</span>
                            )}
                            {item.musica.tom && (
                              <span><span className="font-medium">Tom:</span> {item.musica.tom}</span>
                            )}
                            {item.ministro && (
                              <span><span className="font-medium">Ministro:</span> {item.ministro.nome}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={index === 0}
                              onClick={() => handleMoveMusic(item, 'up')}
                              title="Mover para cima"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={index === musicas.length - 1}
                              onClick={() => handleMoveMusic(item, 'down')}
                              title="Mover para baixo"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-1">
                          {item.musica.letra && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openLetraDialog(item.musica)}
                              title="Ver letra/cifra"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          {item.musica.link && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              asChild
                            >
                              <a href={item.musica.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              {item.musica.letra && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditLetraDialog(item.musica)}
                                  title="Editar letra/cifra"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditMusicDialog(item)}
                                title="Editar música"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveMusic(item.id)}
                                title="Remover música"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members */}
          <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 sm:px-6">
              <CardTitle className="font-serif flex min-w-0 items-center gap-2 text-xl leading-tight">
                <Users className="w-5 h-5 text-primary" />
                Equipe ({membros.length})
              </CardTitle>
              {isAdmin && (
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-serif">Adicionar Membro</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Membro</Label>
                        <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allProfiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Função</Label>
                        <Select value={selectedFuncao} onValueChange={setSelectedFuncao}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {FUNCOES.map(f => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Observação (opcional)</Label>
                        <Textarea
                          value={observacao}
                          onChange={(e) => setObservacao(e.target.value)}
                          placeholder="Ex: Segunda voz no refrão"
                        />
                      </div>
                      <Button className="w-full" variant="gradient" onClick={handleAddMember}>
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {membros.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum membro escalado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {membros.map((membro) => (
                    <div
                      key={membro.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        membro.profile_id === user?.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'bg-secondary/30'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                          membro.profile_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {membro.profile.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium leading-snug break-words">
                            {membro.profile.nome}
                            {membro.profile_id === user?.id && ' (Você)'}
                          </p>
                          <p className="text-sm text-muted-foreground">{membro.funcao_na_escala}</p>
                          {membro.observacao && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              {membro.observacao}
                            </p>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveMember(membro.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Letra/Cifra View Dialog */}
        <Dialog open={isLetraDialogOpen} onOpenChange={setIsLetraDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-4xl h-[88vh] sm:h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {viewingMusica?.titulo}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {viewingMusica?.artista && (
                <span>Artista: {viewingMusica.artista}</span>
              )}
              {viewingMusica?.tom && (
                <span className="font-medium">Tom: {viewingMusica.tom}</span>
              )}
            </div>
            <ScrollArea className="flex-1 mt-4">
              <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed p-4 bg-secondary/30 rounded-lg">
                {viewingMusica?.letra || 'Nenhuma letra/cifra cadastrada.'}
              </pre>
            </ScrollArea>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setIsLetraDialogOpen(false)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Music Dialog */}
        <Dialog open={isEditMusicOpen} onOpenChange={setIsEditMusicOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Editar Música</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-titulo">Título *</Label>
                <Input
                  id="edit-titulo"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  placeholder="Nome da música"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-artista">Artista</Label>
                <Popover open={artistaPopoverOpen} onOpenChange={setArtistaPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={artistaPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {editArtista || "Selecione ou digite um artista..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar ou adicionar artista..." 
                        value={editArtista}
                        onValueChange={setEditArtista}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-2 px-4 text-sm">
                            {editArtista.trim() ? (
                              <Button
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  setArtistaPopoverOpen(false);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar "{editArtista}"
                              </Button>
                            ) : (
                              "Digite o nome do artista"
                            )}
                          </div>
                        </CommandEmpty>
                        <CommandGroup heading="Artistas cadastrados">
                          {Array.from(new Set(allMusicas.map(m => m.artista).filter((a): a is string => a !== null))).map((artist) => (
                            <CommandItem
                              key={artist}
                              value={artist}
                              onSelect={(currentValue) => {
                                setEditArtista(currentValue);
                                setArtistaPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editArtista === artist ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {artist}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-tom">Tom</Label>
                  <Input
                    id="edit-tom"
                    value={editTom}
                    onChange={(e) => setEditTom(e.target.value)}
                    placeholder="Ex: G, Am, D"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-link">Link</Label>
                  <Input
                    id="edit-link"
                    value={editLink}
                    onChange={(e) => setEditLink(e.target.value)}
                    placeholder="YouTube, Cifra..."
                  />
                </div>
              </div>
              <Button
                className="w-full"
                variant="gradient"
                onClick={handleEditMusic}
                disabled={isEditingSaving}
              >
                {isEditingSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Letra/Cifra Dialog */}
        <Dialog open={isEditLetraOpen} onOpenChange={setIsEditLetraOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-4xl h-[88vh] sm:h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Editar Letra / Cifra - {editingLetraMusica?.titulo}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {editingLetraMusica?.artista && (
                <span>Artista: {editingLetraMusica.artista}</span>
              )}
              {editingLetraMusica?.tom && (
                <span>Tom: {editingLetraMusica.tom}</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-4 mt-4 min-h-0">
              <div className="flex-1 min-h-0">
                <Textarea
                  value={editLetra}
                  onChange={(e) => setEditLetra(e.target.value)}
                  placeholder={`Cole aqui a letra e/ou cifra da música...\n\nExemplo:\n\n[Intro] G  D  Em  C\n\n        G                D\nAqui começa a primeira linha\n        Em               C\nE continua a segunda linha\n\n[Refrão]\n        G        D\nEste é o refrão\n        Em       C\nQue todos cantam`}
                  className="h-full min-h-[300px] sm:min-h-[400px] font-mono text-sm resize-none"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setIsEditLetraOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="gradient"
                  className="w-full sm:w-auto"
                  onClick={handleEditLetra}
                  disabled={isEditLeiraSaving}
                >
                  {isEditLeiraSaving ? 'Salvando...' : 'Salvar Letra/Cifra'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
