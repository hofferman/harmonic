import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Trash2, Shield, User, Music, Pencil, Check, X, UserPlus, Loader2 } from 'lucide-react';

interface MembroFuncao {
  id: string;
  funcao: string;
}

interface Membro {
  id: string;
  nome: string;
  created_at: string;
  must_change_password?: boolean;
  role?: 'admin' | 'membro';
  funcoes: MembroFuncao[];
}

const SENHA_PADRAO = 'Mudar@123';

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

export default function Membros() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add function dialog
  const [isAddFuncaoOpen, setIsAddFuncaoOpen] = useState(false);
  const [selectedMembro, setSelectedMembro] = useState<Membro | null>(null);
  const [novaFuncao, setNovaFuncao] = useState('');

  // Edit name
  const [editingNomeId, setEditingNomeId] = useState<string | null>(null);
  const [editingNomeValue, setEditingNomeValue] = useState('');

  // Change role dialog
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [roleMembroId, setRoleMembroId] = useState<string | null>(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);

  // Create user dialog
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

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
    setIsLoading(true);
    try {
      // Fetch all profiles
      let { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, created_at, must_change_password')
        .order('nome');

      if (profilesError && profilesError.message.includes('must_change_password')) {
        const fallback = await supabase
          .from('profiles')
          .select('id, nome, created_at')
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

      // Fetch all member functions
      const { data: funcoesData } = await supabase
        .from('membros_funcoes')
        .select('id, profile_id, funcao');

      if (profilesData) {
        const membrosWithData: Membro[] = profilesData.map(profile => ({
          ...profile,
          role: rolesData?.find(r => r.user_id === profile.id)?.role as 'admin' | 'membro' | undefined,
          funcoes: funcoesData?.filter(f => f.profile_id === profile.id).map(f => ({
            id: f.id,
            funcao: f.funcao,
          })) || [],
        }));

        setMembros(membrosWithData);
      }
    } catch (error) {
      console.error('Error fetching membros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFuncao = async () => {
    if (!selectedMembro || !novaFuncao) return;

    try {
      const { error } = await supabase.from('membros_funcoes').insert({
        profile_id: selectedMembro.id,
        funcao: novaFuncao,
      });

      if (error) throw error;

      toast({ title: 'Função adicionada!' });
      setIsAddFuncaoOpen(false);
      setNovaFuncao('');
      setSelectedMembro(null);
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFuncao = async (funcaoId: string) => {
    try {
      const { error } = await supabase.from('membros_funcoes').delete().eq('id', funcaoId);
      if (error) throw error;

      toast({ title: 'Função removida' });
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEditNome = async (membroId: string) => {
    const trimmed = editingNomeValue.trim();
    if (!trimmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nome: trimmed })
        .eq('id', membroId);

      if (error) throw error;

      toast({ title: 'Nome atualizado!' });
      setEditingNomeId(null);
      setEditingNomeValue('');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleChangeRole = async (newRole: 'admin' | 'membro') => {
    if (!roleMembroId) return;

    try {
      // Delete existing role
      await supabase.from('user_roles').delete().eq('user_id', roleMembroId);

      // Insert new role
      const { error } = await supabase.from('user_roles').insert({
        user_id: roleMembroId,
        role: newRole,
      });

      if (error) throw error;

      toast({ title: 'Permissão alterada!' });
      setIsChangeRoleOpen(false);
      setRoleMembroId(null);
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async () => {
    const nome = newUserNome.trim();
    const email = newUserEmail.trim().toLowerCase();

    if (!nome || !email) {
      toast({
        title: 'Preencha os dados',
        description: 'Nome e email são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      const { error } = await supabase.functions.invoke('admin-create-user', {
        body: { nome, email },
      });

      if (error) throw error;

      toast({
        title: 'Usuário criado!',
        description: `Senha temporária: ${SENHA_PADRAO}. O usuário deverá trocar no primeiro login.`,
      });
      setIsCreateUserOpen(false);
      setNewUserNome('');
      setNewUserEmail('');
      fetchMembros();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message === 'Failed to send a request to the Edge Function'
          ? 'A função admin-create-user ainda não está publicada no Supabase. Publique a Edge Function para criar usuários já confirmados.'
          : error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingUser(false);
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

  const filteredMembros = membros.filter(m =>
    m.nome.toLowerCase().includes(searchTerm.toLowerCase())
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
              Membros
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os membros e suas funções
            </p>
          </div>
          <Button variant="gradient" onClick={() => setIsCreateUserOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Criar usuário
          </Button>
        </div>

        {/* Search */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Input
            placeholder="Buscar membro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Members List */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </>
          ) : filteredMembros.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Nenhum membro encontrado</h3>
              </CardContent>
            </Card>
          ) : (
            filteredMembros.map((membro, index) => (
              <Card
                key={membro.id}
                className="border-0 shadow-md animate-slide-up"
                style={{ animationDelay: `${(index + 2) * 0.1}s` }}
              >
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                        membro.role === 'admin' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {membro.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingNomeId === membro.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingNomeValue}
                                onChange={(e) => setEditingNomeValue(e.target.value)}
                                className="h-8 w-48"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditNome(membro.id);
                                  if (e.key === 'Escape') setEditingNomeId(null);
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-green-500"
                                onClick={() => handleEditNome(membro.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-destructive"
                                onClick={() => setEditingNomeId(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <h3
                              className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors group/name"
                              onClick={() => {
                                setEditingNomeId(membro.id);
                                setEditingNomeValue(membro.nome);
                              }}
                              title="Clique para editar o nome"
                            >
                              {membro.nome}
                              <Pencil className="w-3 h-3 ml-1.5 inline opacity-0 group-hover/name:opacity-50 transition-opacity" />
                            </h3>
                          )}
                          {membro.role === 'admin' ? (
                            <Badge className="bg-primary/10 text-primary border-0">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <User className="w-3 h-3 mr-1" />
                              Membro
                            </Badge>
                          )}
                          {membro.must_change_password && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              Trocar senha
                            </Badge>
                          )}
                        </div>
                        
                        {/* Functions */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {membro.funcoes.map(funcao => (
                            <Badge
                              key={funcao.id}
                              variant="outline"
                              className="pl-2 pr-1 py-1 gap-1 group"
                            >
                              <Music className="w-3 h-3" />
                              {funcao.funcao}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-transparent"
                                onClick={() => handleRemoveFuncao(funcao.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </Badge>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setSelectedMembro(membro);
                              setIsAddFuncaoOpen(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Função
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {membro.id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRoleMembroId(membro.id);
                            setIsChangeRoleOpen(true);
                          }}
                        >
                          Alterar Permissão
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteUser(membro)}
                          disabled={isDeletingUserId === membro.id}
                        >
                          {isDeletingUserId === membro.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Add Function Dialog */}
        <Dialog open={isAddFuncaoOpen} onOpenChange={setIsAddFuncaoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">
                Adicionar Função para {selectedMembro?.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={novaFuncao} onValueChange={setNovaFuncao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCOES_DISPONIVEIS.map(f => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" variant="gradient" onClick={handleAddFuncao}>
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Criar usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="rounded-md border bg-secondary/40 p-3 text-sm">
                Senha temporária: <span className="font-semibold">{SENHA_PADRAO}</span>
                <p className="text-muted-foreground mt-1">
                  No primeiro login, o usuário será obrigado a criar uma nova senha.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-nome">Nome</Label>
                <Input
                  id="new-user-nome"
                  value={newUserNome}
                  onChange={(event) => setNewUserNome(event.target.value)}
                  placeholder="Nome completo"
                  disabled={isCreatingUser}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="usuario@email.com"
                  disabled={isCreatingUser}
                />
              </div>
              <Button className="w-full" variant="gradient" onClick={handleCreateUser} disabled={isCreatingUser}>
                {isCreatingUser ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar com senha temporária'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Role Dialog */}
        <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Alterar Permissão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-muted-foreground">
                Escolha o nível de acesso para este membro:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => handleChangeRole('membro')}
                >
                  <User className="w-6 h-6" />
                  <span className="font-medium">Membro</span>
                  <span className="text-xs text-muted-foreground">Apenas visualização</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => handleChangeRole('admin')}
                >
                  <Shield className="w-6 h-6" />
                  <span className="font-medium">Admin</span>
                  <span className="text-xs text-muted-foreground">Acesso completo</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
