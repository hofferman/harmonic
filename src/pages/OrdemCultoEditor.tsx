import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  Send,
  Copy,
  Music,
  Users,
  BookOpen,
  Megaphone,
  HandCoins,
  Mic2,
  CircleCheck,
  Sparkles,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  OrdemCulto,
  OrdemCultoBloco,
  BlocoTipo,
  BlocoConteudo,
  AberturaConteudo,
  LouvorConteudo,
  OracaoOfertaConteudo,
  AvisosConteudo,
  PregacaoConteudo,
  EncerramentoConteudo,
  EspecialConteudo,
} from '@/types/ordemCulto';
import { BLOCO_TIPO_LABELS, BLOCO_TIPOS_ORDEM } from '@/types/ordemCulto';
import { gerarOrdemCultoMensagem } from '@/lib/ordemCultoMensagem';

interface EscalaOption {
  id: string;
  data: string;
  titulo: string;
}

interface EscalaMembro {
  id: string;
  funcao_na_escala: string;
  profile: { id: string; nome: string };
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
  ministro: { id: string; nome: string } | null;
}

const BLOCO_ICONS: Record<BlocoTipo, React.ElementType> = {
  abertura: Mic2,
  louvor: Music,
  oracao_oferta: HandCoins,
  avisos: Megaphone,
  pregacao: BookOpen,
  encerramento: CircleCheck,
  especial: Sparkles,
};

export default function OrdemCultoEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nova';
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Ordem state
  const [ordem, setOrdem] = useState<OrdemCulto | null>(null);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [escalaId, setEscalaId] = useState<string | null>(null);

  // Blocos state
  const [blocos, setBlocos] = useState<OrdemCultoBloco[]>([]);
  const [blocoContents, setBlocoContents] = useState<Record<string, BlocoConteudo>>({});

  // Escala data
  const [escalas, setEscalas] = useState<EscalaOption[]>([]);
  const [escalaMembros, setEscalaMembros] = useState<EscalaMembro[]>([]);
  const [escalaMusicas, setEscalaMusicas] = useState<EscalaMusica[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(isNew);
  const [newTitulo, setNewTitulo] = useState('');
  const [newData, setNewData] = useState('');
  const [isMensagemDialogOpen, setIsMensagemDialogOpen] = useState(false);
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && user && !isAdmin) {
      // Members can view published orders but not edit
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && !isNew) {
      fetchOrdem();
    }
    if (user) {
      fetchEscalas();
    }
  }, [user, id]);

  useEffect(() => {
    if (escalaId) {
      fetchEscalaData(escalaId);
    } else {
      setEscalaMembros([]);
      setEscalaMusicas([]);
    }
  }, [escalaId]);

  const fetchOrdem = async () => {
    setIsLoading(true);
    try {
      const { data: ordemData, error } = await supabase
        .from('ordens_culto')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const typedOrdem = ordemData as OrdemCulto;
      setOrdem(typedOrdem);
      setTitulo(typedOrdem.titulo);
      setData(typedOrdem.data);
      setEscalaId(typedOrdem.escala_id);
      setHasUnsavedChanges(false);

      // Fetch blocos
      const { data: blocosData, error: blocosError } = await supabase
        .from('ordem_culto_blocos')
        .select('*')
        .eq('ordem_culto_id', id)
        .order('ordem', { ascending: true });

      if (blocosError) throw blocosError;

      if (blocosData) {
        const typedBlocos = blocosData.map(b => ({
          ...b,
          tipo: b.tipo as BlocoTipo,
          conteudo: b.conteudo as unknown as BlocoConteudo,
        })) as OrdemCultoBloco[];
        setBlocos(typedBlocos);

        const contents: Record<string, BlocoConteudo> = {};
        typedBlocos.forEach(b => {
          contents[b.id] = b.conteudo;
        });
        setBlocoContents(contents);
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Error fetching ordem:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a ordem de culto.',
        variant: 'destructive',
      });
      navigate('/ordens-culto');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEscalas = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('escalas')
      .select('id, data, titulo')
      .gte('data', today)
      .order('data', { ascending: false });

    if (data) {
      setEscalas(data);
    }
  };

  const fetchEscalaData = async (escId: string) => {
    const [membrosRes, musicasRes] = await Promise.all([
      supabase
        .from('escala_membros')
        .select(`
          id,
          funcao_na_escala,
          profile:profiles(id, nome)
        `)
        .eq('escala_id', escId)
        .order('funcao_na_escala'),
      supabase
        .from('escala_musicas')
        .select(`
          id,
          ordem,
          ministro:profiles!escala_musicas_ministro_id_fkey(id, nome),
          musica:musicas(id, titulo, artista, tom)
        `)
        .eq('escala_id', escId)
        .order('ordem'),
    ]);

    if (membrosRes.data) {
      setEscalaMembros(
        membrosRes.data.filter((m: any) => m.profile !== null) as unknown as EscalaMembro[]
      );
    }
    if (musicasRes.data) {
      setEscalaMusicas(
        musicasRes.data.filter((m: any) => m.musica !== null) as unknown as EscalaMusica[]
      );
    }
  };

  const handleCreate = async () => {
    if (!newTitulo.trim() || !newData) {
      toast({
        title: 'Erro',
        description: 'Preencha o título e a data.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: ordemData, error } = await supabase
        .from('ordens_culto')
        .insert({
          titulo: newTitulo.trim(),
          data: newData,
          status: 'rascunho',
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default blocos in typical service order
      const defaultBlocosTipos: BlocoTipo[] = [
        'abertura',
        'louvor',
        'oracao_oferta',
        'avisos',
        'pregacao',
        'louvor',
        'encerramento',
      ];
      const defaultBlocos = defaultBlocosTipos.map((tipo, index) => ({
        ordem_culto_id: ordemData.id,
        tipo,
        ordem: index,
        conteudo: {},
      }));

      const { error: blocosError } = await supabase
        .from('ordem_culto_blocos')
        .insert(defaultBlocos);

      if (blocosError) throw blocosError;

      toast({ title: 'Ordem criada!' });
      navigate(`/ordens-culto/${ordemData.id}`, { replace: true });
    } catch (error: any) {
      toast({
        title: 'Erro ao criar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!ordem) return;
    setIsSaving(true);
    try {
      // Update main order
      const { error: ordemError } = await supabase
        .from('ordens_culto')
        .update({
          titulo,
          data,
          escala_id: escalaId,
        })
        .eq('id', ordem.id);

      if (ordemError) throw ordemError;

      // Update all blocos content
      for (const bloco of blocos) {
        const content = blocoContents[bloco.id] || {};
        const { error: blocoError } = await supabase
          .from('ordem_culto_blocos')
          .update({ conteudo: content as any })
          .eq('id', bloco.id);

        if (blocoError) throw blocoError;
      }

      toast({ title: 'Salvo com sucesso!' });
      setOrdem({ ...ordem, titulo, data, escala_id: escalaId });
      setHasUnsavedChanges(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!ordem) return;
    setIsSaving(true);
    try {
      // Save first
      await handleSave();

      const { error } = await supabase
        .from('ordens_culto')
        .update({ status: 'publicada' })
        .eq('id', ordem.id);

      if (error) throw error;

      toast({ title: 'Ordem publicada!' });
      setOrdem({ ...ordem, status: 'publicada' });
    } catch (error: any) {
      toast({
        title: 'Erro ao publicar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBloco = async (tipo: BlocoTipo) => {
    if (!ordem) return;

    try {
      const { data: newBloco, error } = await supabase
        .from('ordem_culto_blocos')
        .insert({
          ordem_culto_id: ordem.id,
          tipo,
          ordem: blocos.length,
          conteudo: {},
        })
        .select()
        .single();

      if (error) throw error;

      const typed = {
        ...newBloco,
        tipo: newBloco.tipo as BlocoTipo,
        conteudo: newBloco.conteudo as unknown as BlocoConteudo,
      } as OrdemCultoBloco;
      setBlocos([...blocos, typed]);
      setBlocoContents({ ...blocoContents, [typed.id]: {} });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveBloco = async (blocoId: string) => {
    if (!confirm('Remover este bloco?')) return;

    try {
      const { error } = await supabase
        .from('ordem_culto_blocos')
        .delete()
        .eq('id', blocoId);

      if (error) throw error;

      const updated = blocos.filter(b => b.id !== blocoId);
      setBlocos(updated);
      const newContents = { ...blocoContents };
      delete newContents[blocoId];
      setBlocoContents(newContents);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMoveBloco = async (blocoId: string, direction: 'up' | 'down') => {
    const currentIndex = blocos.findIndex(b => b.id === blocoId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= blocos.length) return;

    const otherBloco = blocos[newIndex];

    try {
      await Promise.all([
        supabase
          .from('ordem_culto_blocos')
          .update({ ordem: newIndex })
          .eq('id', blocoId),
        supabase
          .from('ordem_culto_blocos')
          .update({ ordem: currentIndex })
          .eq('id', otherBloco.id),
      ]);

      const updated = [...blocos];
      updated[currentIndex] = { ...blocos[newIndex], ordem: currentIndex };
      updated[newIndex] = { ...blocos[currentIndex], ordem: newIndex };
      setBlocos(updated);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateBlocoContent = (blocoId: string, field: string, value: string) => {
    setHasUnsavedChanges(true);
    setBlocoContents(prev => ({
      ...prev,
      [blocoId]: {
        ...(prev[blocoId] || {}),
        [field]: value,
      },
    }));
  };

  const buildMensagemWhatsApp = () => {
    if (!ordem) return;
    const mensagem = gerarOrdemCultoMensagem(
      { ...ordem, titulo, data },
      blocos,
      blocoContents,
      escalaId ? { membros: escalaMembros, musicas: escalaMusicas } : undefined
    );
    setMensagemWhatsApp(mensagem);
    setIsMensagemDialogOpen(true);
    return mensagem;
  };

  const handleCopyMensagem = async () => {
    const mensagem = mensagemWhatsApp || buildMensagemWhatsApp();
    if (!mensagem) return;

    try {
      await navigator.clipboard.writeText(mensagem);
      toast({
        title: 'Mensagem copiada!',
        description: 'Agora é só colar no WhatsApp.',
      });
    } catch (error) {
      console.error('Error copying message:', error);
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: 'Selecione o texto da prévia e copie manualmente.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyAndOpenWhatsApp = async () => {
    const mensagem = mensagemWhatsApp || buildMensagemWhatsApp();
    if (!mensagem) return;

    try {
      await navigator.clipboard.writeText(mensagem);
      toast({
        title: 'Mensagem copiada!',
        description: 'O WhatsApp será aberto para você colar ou enviar.',
      });
    } catch (error) {
      console.error('Error copying message:', error);
      toast({
        title: 'Abrindo WhatsApp',
        description: 'Não consegui copiar automaticamente, mas a mensagem vai preenchida no link.',
      });
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  // Render block content based on type
  const renderBlocoContent = (bloco: OrdemCultoBloco) => {
    const content = blocoContents[bloco.id] || {};
    const isReadOnly = !isAdmin;

    switch (bloco.tipo) {
      case 'abertura': {
        const c = content as AberturaConteudo;
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Dirigente</Label>
            <Input
              placeholder="Nome do dirigente"
              value={c.dirigente || ''}
              onChange={(e) => updateBlocoContent(bloco.id, 'dirigente', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
        );
      }

      case 'louvor': {
        const c = content as LouvorConteudo;
        const selectedIds = c.musica_ids || [];

        const toggleMusica = (musicaId: string) => {
          const current = selectedIds;
          const updated = current.includes(musicaId)
            ? current.filter(id => id !== musicaId)
            : [...current, musicaId];
          setHasUnsavedChanges(true);
          setBlocoContents(prev => ({
            ...prev,
            [bloco.id]: { ...prev[bloco.id], musica_ids: updated },
          }));
        };

        // Filter selected musicas preserving escala order
        const selectedMusicas = escalaMusicas.filter(m => selectedIds.includes(m.musica.id));

        return (
          <div className="space-y-3">
            {!escalaId ? (
              <p className="text-sm text-muted-foreground italic">
                Selecione uma escala acima para exibir a equipe e as músicas.
              </p>
            ) : (
              <>
                {escalaMembros.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Equipe</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {escalaMembros.map(m => (
                        <Badge key={m.id} variant="outline" className="text-xs">
                          {m.profile.nome} ({m.funcao_na_escala})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {escalaMusicas.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Músicas ({selectedIds.length} de {escalaMusicas.length} selecionadas)
                    </Label>
                    <div className="space-y-1.5 mt-2">
                      {escalaMusicas.map((item) => {
                        const isSelected = selectedIds.includes(item.musica.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-start gap-3 text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-secondary/50'
                            } ${isReadOnly ? 'pointer-events-none' : ''}`}
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={isSelected}
                              onCheckedChange={() => toggleMusica(item.musica.id)}
                              disabled={isReadOnly}
                            />
                            <span className="min-w-0 flex-1">
                              <span className={`block font-medium leading-snug break-words ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {item.musica.titulo}
                              </span>
                              {item.musica.artista && (
                                <span className="block text-muted-foreground leading-snug break-words">{item.musica.artista}</span>
                              )}
                            </span>
                            {item.musica.tom && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {item.musica.tom}
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {escalaMembros.length === 0 && escalaMusicas.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    A escala selecionada não possui membros ou músicas.
                  </p>
                )}
              </>
            )}
          </div>
        );
      }

      case 'oracao_oferta': {
        const c = content as OracaoOfertaConteudo;
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Pessoa</Label>
            <Input
              placeholder="Nome de quem faz a oração"
              value={c.pessoa || ''}
              onChange={(e) => updateBlocoContent(bloco.id, 'pessoa', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
        );
      }

      case 'avisos': {
        const c = content as AvisosConteudo;
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Avisos</Label>
            <Textarea
              placeholder="Texto dos avisos..."
              value={c.texto || ''}
              onChange={(e) => updateBlocoContent(bloco.id, 'texto', e.target.value)}
              disabled={isReadOnly}
              rows={3}
            />
          </div>
        );
      }

      case 'pregacao': {
        const c = content as PregacaoConteudo;
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pregador</Label>
              <Input
                placeholder="Nome do pregador"
                value={c.pregador || ''}
                onChange={(e) => updateBlocoContent(bloco.id, 'pregador', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tema da mensagem</Label>
              <Input
                placeholder="Tema"
                value={c.tema || ''}
                onChange={(e) => updateBlocoContent(bloco.id, 'tema', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Texto bíblico</Label>
              <Input
                placeholder="Ex: João 3:16"
                value={c.versiculo || ''}
                onChange={(e) => updateBlocoContent(bloco.id, 'versiculo', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
        );
      }

      case 'encerramento': {
        const c = content as EncerramentoConteudo;
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Responsável pelo encerramento</Label>
            <Input
              placeholder="Nome de quem encerra o culto"
              value={c.pessoa || ''}
              onChange={(e) => updateBlocoContent(bloco.id, 'pessoa', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
        );
      }

      case 'especial': {
        const c = content as EspecialConteudo;
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Título do momento</Label>
              <Input
                placeholder="Ex: Batismo, Santa Ceia, Testemunho..."
                value={c.titulo || ''}
                onChange={(e) => updateBlocoContent(bloco.id, 'titulo', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                placeholder="Detalhes sobre este momento..."
                value={c.descricao || ''}
                onChange={(e) => updateBlocoContent(bloco.id, 'descricao', e.target.value)}
                disabled={isReadOnly}
                rows={3}
              />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  // Create dialog for new orders
  if (isNew) {
    return (
      <AppLayout>
        <div className="px-3 py-4 sm:p-4 lg:p-8 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate('/ordens-culto')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold">Nova Ordem de Culto</h2>
                <p className="text-muted-foreground mt-1">Preencha as informações básicas para começar.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: Culto Domingo Manhã"
                    value={newTitulo}
                    onChange={(e) => setNewTitulo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={newData}
                    onChange={(e) => setNewData(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="gradient"
                  onClick={handleCreate}
                  disabled={isSaving}
                >
                  {isSaving ? 'Criando...' : 'Criar Ordem de Culto'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4 sm:p-4 lg:p-8 space-y-5 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="animate-fade-in">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/ordens-culto')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-48" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-3">
                  {isAdmin ? (
                    <>
                      <Input
                        value={titulo}
                        onChange={(e) => {
                          setTitulo(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        className="text-2xl font-serif font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 h-auto py-1"
                        placeholder="Título da ordem"
                      />
                      <div className="flex items-center gap-4 flex-wrap">
                        <Input
                          type="date"
                          value={data}
                          onChange={(e) => {
                            setData(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-auto"
                        />
                        <Badge className={ordem?.status === 'publicada'
                          ? 'bg-green-500/10 text-green-600 border-0'
                          : ''
                        }>
                          {ordem?.status === 'publicada' ? 'Publicada' : 'Rascunho'}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl lg:text-3xl font-serif font-bold">{titulo}</h1>
                      <div className="flex items-center gap-4 flex-wrap">
                        <p className="text-muted-foreground capitalize">
                          {data && format(new Date(data + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <Badge className={ordem?.status === 'publicada'
                          ? 'bg-green-500/10 text-green-600 border-0'
                          : ''
                        }>
                          {ordem?.status === 'publicada' ? 'Publicada' : 'Rascunho'}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
                  {isAdmin && (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={handleSave} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                  )}
                  {!hasUnsavedChanges && (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={buildMensagemWhatsApp}>
                      <Copy className="w-4 h-4 mr-2" />
                      Mensagem
                    </Button>
                  )}
                  {isAdmin && ordem?.status !== 'publicada' && (
                    <Button variant="gradient" className="w-full sm:w-auto" onClick={handlePublish} disabled={isSaving}>
                      <Send className="w-4 h-4 mr-2" />
                      Publicar
                    </Button>
                  )}
                </div>
              </div>

              {/* Escala selector */}
              {isAdmin && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Escala vinculada:</Label>
                  <Select
                    value={escalaId || 'none'}
                    onValueChange={(v) => {
                      setEscalaId(v === 'none' ? null : v);
                      setHasUnsavedChanges(true);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Selecione uma escala..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {escalas.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.titulo} ({format(new Date(e.data + 'T00:00:00'), 'dd/MM/yyyy')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <Dialog open={isMensagemDialogOpen} onOpenChange={setIsMensagemDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Mensagem para WhatsApp</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={mensagemWhatsApp}
                onChange={(event) => setMensagemWhatsApp(event.target.value)}
                className="min-h-[300px] sm:min-h-[360px] font-mono text-sm"
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsMensagemDialogOpen(false)}>
                  Fechar
                </Button>
                <Button className="w-full sm:w-auto" onClick={handleCopyMensagem}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar mensagem
                </Button>
                <Button variant="gradient" className="w-full sm:w-auto" onClick={handleCopyAndOpenWhatsApp}>
                  <Send className="w-4 h-4 mr-2" />
                  Copiar e abrir WhatsApp
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Blocos */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {blocos.map((bloco, index) => {
              const Icon = BLOCO_ICONS[bloco.tipo];
              return (
                <Card
                  key={bloco.id}
                  className="border-0 shadow-md animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardContent className="p-3 sm:p-4 lg:p-6">
                    <div className="flex gap-3">
                      {/* Reorder buttons */}
                      {isAdmin && (
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7"
                            disabled={index === 0}
                            onClick={() => handleMoveBloco(bloco.id, 'up')}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7"
                            disabled={index === blocos.length - 1}
                            onClick={() => handleMoveBloco(bloco.id, 'down')}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      {/* Block content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                              {index + 1}
                            </span>
                            <Icon className="w-4 h-4 text-primary shrink-0" />
                            <h3 className="font-semibold leading-snug break-words">{BLOCO_TIPO_LABELS[bloco.tipo]}</h3>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveBloco(bloco.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>

                        {renderBlocoContent(bloco)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Add block button */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full border-dashed">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Bloco
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {BLOCO_TIPOS_ORDEM.map(tipo => {
                    const Icon = BLOCO_ICONS[tipo];
                    return (
                      <DropdownMenuItem key={tipo} onClick={() => handleAddBloco(tipo)}>
                        <Icon className="w-4 h-4 mr-2" />
                        {BLOCO_TIPO_LABELS[tipo]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
