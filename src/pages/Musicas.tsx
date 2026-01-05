import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Music, Plus, Trash2, ExternalLink, Edit2, FileText, X } from 'lucide-react';

interface Musica {
  id: string;
  titulo: string;
  artista: string | null;
  tom: string | null;
  link: string | null;
  letra: string | null;
  created_at: string;
}

export default function Musicas() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMusica, setEditingMusica] = useState<Musica | null>(null);
  const [titulo, setTitulo] = useState('');
  const [artista, setArtista] = useState('');
  const [tom, setTom] = useState('');
  const [link, setLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Letra dialog state
  const [isLetraDialogOpen, setIsLetraDialogOpen] = useState(false);
  const [letraMusica, setLetraMusica] = useState<Musica | null>(null);
  const [letra, setLetra] = useState('');
  const [isSavingLetra, setIsSavingLetra] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && user && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchMusicas();
    }
  }, [user, isAdmin]);

  const fetchMusicas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('musicas')
        .select('*')
        .order('titulo');

      if (error) throw error;
      setMusicas(data || []);
    } catch (error) {
      console.error('Error fetching musicas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (musica?: Musica) => {
    if (musica) {
      setEditingMusica(musica);
      setTitulo(musica.titulo);
      setArtista(musica.artista || '');
      setTom(musica.tom || '');
      setLink(musica.link || '');
    } else {
      setEditingMusica(null);
      setTitulo('');
      setArtista('');
      setTom('');
      setLink('');
    }
    setIsDialogOpen(true);
  };

  const openLetraDialog = (musica: Musica) => {
    setLetraMusica(musica);
    setLetra(musica.letra || '');
    setIsLetraDialogOpen(true);
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({
        title: 'Erro',
        description: 'O título é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const musicaData = {
        titulo: titulo.trim(),
        artista: artista.trim() || null,
        tom: tom.trim() || null,
        link: link.trim() || null,
      };

      if (editingMusica) {
        const { error } = await supabase
          .from('musicas')
          .update(musicaData)
          .eq('id', editingMusica.id);

        if (error) throw error;
        toast({ title: 'Música atualizada!' });
      } else {
        const { error } = await supabase.from('musicas').insert(musicaData);
        if (error) throw error;
        toast({ title: 'Música cadastrada!' });
      }

      setIsDialogOpen(false);
      fetchMusicas();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLetra = async () => {
    if (!letraMusica) return;

    setIsSavingLetra(true);
    try {
      const { error } = await supabase
        .from('musicas')
        .update({ letra: letra.trim() || null })
        .eq('id', letraMusica.id);

      if (error) throw error;
      
      toast({ title: 'Letra/cifra salva!' });
      setIsLetraDialogOpen(false);
      fetchMusicas();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingLetra(false);
    }
  };

  const handleDelete = async (musicaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta música?')) return;

    try {
      const { error } = await supabase.from('musicas').delete().eq('id', musicaId);
      if (error) throw error;

      toast({ title: 'Música excluída' });
      fetchMusicas();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredMusicas = musicas.filter(m =>
    m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.artista?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              Músicas
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o repertório do ministério
            </p>
          </div>
          
          <Button variant="gradient" onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Música
          </Button>
        </div>

        {/* Search */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Input
            placeholder="Buscar por título ou artista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Music List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </>
          ) : filteredMusicas.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'Nenhuma música encontrada' : 'Nenhuma música cadastrada'}
                </h3>
                {!searchTerm && (
                  <p className="text-muted-foreground">
                    Clique em "Nova Música" para começar.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredMusicas.map((musica, index) => (
              <Card
                key={musica.id}
                className="border-0 shadow-md hover:shadow-lg transition-shadow animate-slide-up"
                style={{ animationDelay: `${(index + 2) * 0.05}s` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                        <Music className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{musica.titulo}</h3>
                          {musica.letra && (
                            <Badge variant="secondary" className="shrink-0">
                              <FileText className="w-3 h-3 mr-1" />
                              Cifra
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {musica.artista || 'Artista desconhecido'}
                          {musica.tom && ` • Tom: ${musica.tom}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openLetraDialog(musica)}
                        title="Editar letra/cifra"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      {musica.link && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={musica.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openDialog(musica)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(musica.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Music Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">
                {editingMusica ? 'Editar Música' : 'Nova Música'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Nome da música"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="artista">Artista</Label>
                <Input
                  id="artista"
                  value={artista}
                  onChange={(e) => setArtista(e.target.value)}
                  placeholder="Nome do artista ou banda"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tom">Tom</Label>
                  <Input
                    id="tom"
                    value={tom}
                    onChange={(e) => setTom(e.target.value)}
                    placeholder="Ex: G, Am, D"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link">Link</Label>
                  <Input
                    id="link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="YouTube, Cifra..."
                  />
                </div>
              </div>
              <Button
                className="w-full"
                variant="gradient"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Salvando...' : editingMusica ? 'Salvar Alterações' : 'Cadastrar Música'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Letra/Cifra Dialog */}
        <Dialog open={isLetraDialogOpen} onOpenChange={setIsLetraDialogOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Letra / Cifra - {letraMusica?.titulo}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col gap-4 mt-4 min-h-0">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {letraMusica?.artista && (
                  <span>Artista: {letraMusica.artista}</span>
                )}
                {letraMusica?.tom && (
                  <span>Tom: {letraMusica.tom}</span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <Textarea
                  value={letra}
                  onChange={(e) => setLetra(e.target.value)}
                  placeholder={`Cole aqui a letra e/ou cifra da música...\n\nExemplo:\n\n[Intro] G  D  Em  C\n\n        G                D\nAqui começa a primeira linha\n        Em               C\nE continua a segunda linha\n\n[Refrão]\n        G        D\nEste é o refrão\n        Em       C\nQue todos cantam`}
                  className="h-full min-h-[400px] font-mono text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsLetraDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleSaveLetra}
                  disabled={isSavingLetra}
                >
                  {isSavingLetra ? 'Salvando...' : 'Salvar Letra/Cifra'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
