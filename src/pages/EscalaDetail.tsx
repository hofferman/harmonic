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
  GripVertical, ExternalLink, Star, FileText, X
} from 'lucide-react';
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

  const openLetraDialog = (musica: EscalaMusica['musica']) => {
    setViewingMusica(musica);
    setIsLetraDialogOpen(true);
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
        <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
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
        <div className="p-4 lg:p-8 text-center">
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
      <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
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
          
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-serif font-bold">
                  {escala.titulo}
                </h1>
                {getStatusBadge()}
              </div>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {format(new Date(escala.data + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            {isCurrentUserMember && (
              <Badge className="bg-primary text-primary-foreground shrink-0">
                <Star className="w-3 h-3 mr-1" />
                {currentUserFuncao}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Members */}
          <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Equipe ({membros.length})
              </CardTitle>
              {isAdmin && (
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
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
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        membro.profile_id === user?.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'bg-secondary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                          membro.profile_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {membro.profile.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium">
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
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

          {/* Songs */}
          <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                Repertório ({musicas.length})
              </CardTitle>
              {isAdmin && (
                <Dialog open={isAddMusicOpen} onOpenChange={setIsAddMusicOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
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
                <div className="space-y-2">
                  {musicas.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                    >
                      <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item.musica.titulo}</p>
                          {item.musica.letra && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              Cifra
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.musica.artista || 'Artista desconhecido'}
                          {item.musica.tom && ` • Tom: ${item.musica.tom}`}
                          {item.ministro && ` • Ministro: ${item.ministro.nome}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.musica.letra && (
                          <Button
                            variant="ghost"
                            size="icon"
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
                            asChild
                          >
                            <a href={item.musica.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMusic(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Letra/Cifra View Dialog */}
        <Dialog open={isLetraDialogOpen} onOpenChange={setIsLetraDialogOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {viewingMusica?.titulo}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
      </div>
    </AppLayout>
  );
}
