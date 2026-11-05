import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Trash2, Shield, Music, Pencil, Check, X, Loader2, Phone, BellOff, Search, Settings } from 'lucide-react';
import { clearPageCache, readPageCache, writePageCache } from '@/lib/pageCache';
import { Link } from 'react-router-dom';

interface MembroFuncao {
  id: string;
  funcao: string;
}

interface Setor {
  id: string;
  nome: string;
}

interface Membro {
  id: string;
  nome: string;
  telefone?: string | null;
  receber_avisos?: boolean;
  created_at: string;
  must_change_password?: boolean;
  role?: 'admin' | 'membro';
  funcoes: MembroFuncao[];
  setores: Setor[];
}

// Guarda so digitos no formato internacional (55 + DDD + numero), que e o
// que a Evolution API espera. A tela aceita o numero digitado de qualquer
// jeito e normaliza aqui.
const normalizarTelefone = (bruto: string): string | null => {
  const d = (bruto || '').replace(/\D/g, '');
  if (!d) return null;
  const comPais = d.startsWith('55') ? d : `55${d}`;
  // 55 + DDD (2) + numero (8 ou 9)
  return /^55[1-9][0-9]{9,10}$/.test(comPais) ? comPais : null;
};

const formatarTelefone = (tel?: string | null): string => {
  if (!tel) return '';
  const d = tel.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
};

const FUNCOES_DISPONIVEIS = [
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

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function Membros() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Membro selecionado para edição
  const [selectedMembro, setSelectedMembro] = useState<Membro | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Edição de nome
  const [editingNome, setEditingNome] = useState('');
  const [isSavingNome, setIsSavingNome] = useState(false);
  
  // Edição de telefone
  const [editingTelefone, setEditingTelefone] = useState('');
  const [isSavingTelefone, setIsSavingTelefone] = useState(false);
  
  // Funções
  const [novaFuncao, setNovaFuncao] = useState('');
  const [isAddingFuncao, setIsAddingFuncao] = useState(false);
  
  // Setores
  const [novoSetorId, setNovoSetorId] = useState('');
  const [isAddingSetor, setIsAddingSetor] = useState(false);
  
  // Toggle avisos
  const [isTogglingAvisos, setIsTogglingAvisos] = useState(false);
  
  // Exclusão de usuário
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);

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
      fetchMembros();
    }
  }, [user, isAdmin]);

  const fetchMembros = async () => {
    const cacheKey = 'membros';
    const cached = readPageCache<Membro[]>(cacheKey);

    if (cached) {
      setMembros(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      // Fetch all profiles
      let { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, telefone, receber_avisos, created_at, must_change_password')
        .order('nome');

      if (profilesError && profilesError.message.includes('must_change_password')) {
        const fallback = await supabase
          .from('profiles')
          .select('id, nome, telefone, receber_avisos, created_at')
          .order('nome');

        profilesData = fallback.data?.map(profile => ({
          ...profile,
          must_change_password: false,
        })) ?? null;
        profilesError = fallback.error;
      }

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: setoresData } = await supabase
        .from('setores')
        .select('id, nome')
        .order('nome');

      setSetores(setoresData || []);

      // Fetch all member functions
      const { data: funcoesData } = await supabase
        .from('membros_funcoes')
        .select('id, profile_id, funcao');

      const { data: membrosSetoresData } = await supabase
        .from('membros_setores')
        .select('profile_id, setor:setores(id, nome)');

      if (profilesData) {
        const membrosWithData: Membro[] = profilesData.map(profile => ({
          ...profile,
          role: rolesData?.find(r => r.user_id === profile.id)?.role as 'admin' | 'membro' | undefined,
          funcoes: funcoesData?.filter(f => f.profile_id === profile.id).map(f => ({
            id: f.id,
            funcao: f.funcao,
          })) || [],
          setores: membrosSetoresData?.filter(item => item.profile_id === profile.id)
            .map(item => item.setor)
            .filter((setor): setor is Setor => !!setor) || [],
        }));

        setMembros(membrosWithData);
        writePageCache(cacheKey, membrosWithData);
      }
    } catch (error) {
      console.error('Error fetching membros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (membro: Membro) => {
    setSelectedMembro(membro);
    setEditingNome(membro.nome);
    setEditingTelefone(formatarTelefone(membro.telefone));
    setNovaFuncao('');
    setNovoSetorId('');
    setIsEditDialogOpen(true);
  };

  const handleSaveNome = async () => {
    if (!selectedMembro) return;
    const trimmed = editingNome.trim();
    if (!trimmed || trimmed === selectedMembro.nome) return;

    setIsSavingNome(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nome: trimmed })
        .eq('id', selectedMembro.id);

      if (error) throw error;

      toast({ title: 'Nome atualizado!' });
      clearPageCache('membros');
      fetchMembros();
      setSelectedMembro({ ...selectedMembro, nome: trimmed });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingNome(false);
    }
  };

  const handleSaveTelefone = async () => {
    if (!selectedMembro) return;
    const bruto = editingTelefone.trim();

    // campo vazio remove o telefone (a pessoa deixa de receber aviso)
    const valor = bruto === '' ? null : normalizarTelefone(bruto);
    if (bruto !== '' && valor === null) {
      toast({
        title: 'Telefone inválido',
        description: 'Use DDD + número, ex: (11) 98765-4321.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingTelefone(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telefone: valor })
        .eq('id', selectedMembro.id);

      if (error) throw error;

      toast({ title: valor ? 'Telefone salvo!' : 'Telefone removido.' });
      clearPageCache('membros');
      fetchMembros();
      setSelectedMembro({ ...selectedMembro, telefone: valor });
      setEditingTelefone(formatarTelefone(valor));
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingTelefone(false);
    }
  };

  const handleToggleAvisos = async () => {
    if (!selectedMembro) return;
    const atual = selectedMembro.receber_avisos !== false;

    setIsTogglingAvisos(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ receber_avisos: !atual })
        .eq('id', selectedMembro.id);

      if (error) throw error;

      toast({
        title: !atual ? 'Avisos ativados' : 'Avisos desativados',
        description: !atual
          ? 'Esta pessoa voltará a receber aviso de escala.'
          : 'Esta pessoa não receberá mais aviso de escala.',
      });
      clearPageCache('membros');
      fetchMembros();
      setSelectedMembro({ ...selectedMembro, receber_avisos: !atual });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsTogglingAvisos(false);
    }
  };

  const handleAddFuncao = async () => {
    if (!selectedMembro || !novaFuncao) return;

    setIsAddingFuncao(true);
    try {
      const { error } = await supabase.from('membros_funcoes').insert({
        profile_id: selectedMembro.id,
        funcao: novaFuncao,
      });

      if (error) throw error;

      toast({ title: 'Função adicionada!' });
      setNovaFuncao('');
      clearPageCache('membros');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingFuncao(false);
    }
  };

  const handleRemoveFuncao = async (funcaoId: string) => {
    try {
      const { error } = await supabase.from('membros_funcoes').delete().eq('id', funcaoId);
      if (error) throw error;

      toast({ title: 'Função removida' });
      clearPageCache('membros');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddSetor = async () => {
    if (!selectedMembro || !novoSetorId) return;

    setIsAddingSetor(true);
    try {
      const { error } = await supabase.from('membros_setores').insert({
        profile_id: selectedMembro.id,
        setor_id: novoSetorId,
      });

      if (error) throw error;

      toast({ title: 'Ministério adicionado!' });
      setNovoSetorId('');
      clearPageCache('membros');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingSetor(false);
    }
  };

  const handleRemoveSetor = async (setorId: string) => {
    if (!selectedMembro) return;
    try {
      const { error } = await supabase
        .from('membros_setores')
        .delete()
        .eq('profile_id', selectedMembro.id)
        .eq('setor_id', setorId);

      if (error) throw error;

      toast({ title: 'Ministério removido' });
      clearPageCache('membros');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (membro: Membro) => {
    if (membro.id === user?.id) return;

    const confirmed = confirm(
      `Excluir o usuário ${membro.nome}? Esta ação remove o login e os dados vinculados a este membro.`,
    );

    if (!confirmed) return;

    setIsDeletingUserId(membro.id);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: membro.id },
      });

      if (error) throw error;

      toast({ title: 'Usuário excluído!' });
      setIsEditDialogOpen(false);
      setSelectedMembro(null);
      clearPageCache('membros');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description: error.message === 'Failed to send a request to the Edge Function'
          ? 'A função admin-delete-user ainda não está publicada no Supabase.'
          : error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeletingUserId(null);
    }
  };

  // Atualiza o membro selecionado quando os dados mudam
  useEffect(() => {
    if (selectedMembro) {
      const updated = membros.find((m) => m.id === selectedMembro.id);
      if (updated) {
        setSelectedMembro(updated);
      }
    }
  }, [membros]);

  const filteredMembros = membros.filter(m =>
    m.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableSetoresForSelected = selectedMembro
    ? setores.filter((s) => !selectedMembro.setores.some((ms) => ms.id === s.id))
    : [];

  const availableFuncoesForSelected = selectedMembro
    ? FUNCOES_DISPONIVEIS.filter((f) => !selectedMembro.funcoes.some((mf) => mf.funcao === f))
    : [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  Membros
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie dados, funções e ministérios dos membros
                </p>
              </div>
            </div>
            <Link to="/configuracoes">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Convidar / Permissões
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="animate-slide-up relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar membro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full sm:max-w-sm"
          />
        </div>

        {/* Members List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </>
          ) : filteredMembros.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Nenhum membro encontrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Comece convidando pessoas para o Harmonic.
                </p>
                <Link to="/configuracoes">
                  <Button variant="gradient">
                    <Plus className="h-4 w-4" />
                    Convidar pessoas
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md">
              <CardHeader className="border-b bg-secondary/20">
                <CardTitle className="text-lg">
                  {filteredMembros.length} membro{filteredMembros.length !== 1 ? 's' : ''}
                </CardTitle>
                <CardDescription>
                  Clique em um membro para editar seus dados e funções
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {filteredMembros.map((membro) => {
                  const isSelf = membro.id === user?.id;
                  return (
                    <button
                      key={membro.id}
                      type="button"
                      onClick={() => openEditDialog(membro)}
                      className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-secondary/20 sm:px-6"
                    >
                      <Avatar className={`h-11 w-11 ${membro.role === 'admin' ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                        <AvatarFallback className={`text-sm font-semibold ${membro.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          {getInitials(membro.nome)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">{membro.nome}</p>
                          {isSelf && <Badge variant="outline">Você</Badge>}
                          {membro.role === 'admin' && (
                            <Badge className="border-0 bg-primary/10 text-primary gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          {membro.must_change_password && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              Trocar senha
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {membro.funcoes.length > 0 ? (
                            membro.funcoes.slice(0, 3).map(funcao => (
                              <Badge key={funcao.id} variant="outline" className="gap-1">
                                <Music className="h-3 w-3" />
                                {funcao.funcao}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem função definida</span>
                          )}
                          {membro.funcoes.length > 3 && (
                            <Badge variant="outline">+{membro.funcoes.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                      
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Member Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedMembro(null);
          }
        }}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                {selectedMembro && (
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`text-sm font-semibold ${selectedMembro.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      {getInitials(selectedMembro.nome)}
                    </AvatarFallback>
                  </Avatar>
                )}
                Editar membro
              </DialogTitle>
              <DialogDescription>
                Atualize os dados, funções e ministérios deste membro.
              </DialogDescription>
            </DialogHeader>

            {selectedMembro && (
              <div className="space-y-6 mt-4">
                {/* Nome */}
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editingNome}
                      onChange={(e) => setEditingNome(e.target.value)}
                      placeholder="Nome completo"
                      disabled={isSavingNome}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSaveNome}
                      disabled={isSavingNome || editingNome.trim() === selectedMembro.nome}
                    >
                      {isSavingNome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editingTelefone}
                      onChange={(e) => setEditingTelefone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      inputMode="tel"
                      disabled={isSavingTelefone}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSaveTelefone}
                      disabled={isSavingTelefone}
                    >
                      {isSavingTelefone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado para enviar avisos de escala pelo WhatsApp
                  </p>
                </div>

                {/* Avisos */}
                {selectedMembro.telefone && (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      {selectedMembro.receber_avisos === false ? (
                        <BellOff className="h-5 w-5 text-amber-600" />
                      ) : (
                        <Phone className="h-5 w-5 text-primary" />
                      )}
                      <div>
                        <p className="font-medium">
                          {selectedMembro.receber_avisos === false ? 'Avisos desativados' : 'Recebe avisos de escala'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedMembro.receber_avisos === false
                            ? 'Esta pessoa não receberá avisos no WhatsApp'
                            : 'Receberá mensagem automática quando escalado'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleAvisos}
                      disabled={isTogglingAvisos}
                    >
                      {isTogglingAvisos ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : selectedMembro.receber_avisos === false ? (
                        'Ativar'
                      ) : (
                        'Desativar'
                      )}
                    </Button>
                  </div>
                )}

                {/* Ministérios */}
                <div className="space-y-3">
                  <Label>Ministérios</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembro.setores.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nenhum ministério vinculado</span>
                    ) : (
                      selectedMembro.setores.map((setor) => (
                        <Badge key={setor.id} variant="secondary" className="gap-1 pl-2 pr-1 py-1.5">
                          <Users className="h-3 w-3" />
                          <span>{setor.nome}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-1 text-destructive hover:text-destructive hover:bg-transparent"
                            onClick={() => handleRemoveSetor(setor.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>
                  {availableSetoresForSelected.length > 0 && (
                    <div className="flex gap-2">
                      <Select value={novoSetorId} onValueChange={setNovoSetorId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Adicionar ministério..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSetoresForSelected.map((setor) => (
                            <SelectItem key={setor.id} value={setor.id}>
                              {setor.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAddSetor}
                        disabled={!novoSetorId || isAddingSetor}
                      >
                        {isAddingSetor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Funções musicais */}
                <div className="space-y-3">
                  <Label>Funções musicais</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembro.funcoes.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nenhuma função definida</span>
                    ) : (
                      selectedMembro.funcoes.map((funcao) => (
                        <Badge key={funcao.id} variant="outline" className="gap-1 pl-2 pr-1 py-1.5">
                          <Music className="h-3 w-3" />
                          <span>{funcao.funcao}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-1 text-destructive hover:text-destructive hover:bg-transparent"
                            onClick={() => handleRemoveFuncao(funcao.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>
                  {availableFuncoesForSelected.length > 0 && (
                    <div className="flex gap-2">
                      <Select value={novaFuncao} onValueChange={setNovaFuncao}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Adicionar função..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFuncoesForSelected.map((funcao) => (
                            <SelectItem key={funcao} value={funcao}>
                              {funcao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAddFuncao}
                        disabled={!novaFuncao || isAddingFuncao}
                      >
                        {isAddingFuncao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Ações */}
                {selectedMembro.id !== user?.id && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteUser(selectedMembro)}
                      disabled={isDeletingUserId === selectedMembro.id}
                    >
                      {isDeletingUserId === selectedMembro.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Excluir usuário
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
