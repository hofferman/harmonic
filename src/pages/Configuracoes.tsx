import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { clearPageCache } from '@/lib/pageCache';
import {
  Settings,
  UserPlus,
  Users,
  Loader2,
  Plus,
  KeyRound,
  ListOrdered,
  ChevronRight,
  Shield,
  Search,
  Building2,
  UserCog,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Setor {
  id: string;
  nome: string;
}

interface UsuarioConfig {
  id: string;
  nome: string;
  role: 'admin' | 'membro';
  canViewOrdemCulto: boolean;
  setores: Setor[];
}

const SENHA_PADRAO = 'Mudar@123';
const MINISTERIOS_FALLBACK: Setor[] = [
  { id: 'louvor', nome: 'Louvor' },
  { id: 'farol', nome: 'Farol' },
  { id: 'acesso', nome: 'Acesso' },
];

export default function Configuracoes() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [setores, setSetores] = useState<Setor[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(true);
  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [novoSetorNome, setNovoSetorNome] = useState('');
  const [isCreatingSetor, setIsCreatingSetor] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [updatingPermissionId, setUpdatingPermissionId] = useState<string | null>(null);
  const [updatingSetorUserId, setUpdatingSetorUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<string | null>(null);

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
      fetchSetores();
      fetchUsuarios();
    }
  }, [user, isAdmin]);

  const fetchSetores = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('setores')
        .select('id, nome')
        .order('nome');

      if (error) {
        setSetores(MINISTERIOS_FALLBACK);
        return;
      }

      setSetores(data || []);
    } catch (error) {
      console.error('Error fetching ministerios:', error);
      setSetores(MINISTERIOS_FALLBACK);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    setIsLoadingUsuarios(true);
    try {
      const [
        { data: profilesData, error: profilesError },
        { data: rolesData },
        { data: permissionsData, error: permissionsError },
        { data: membrosSetoresData, error: membrosSetoresError },
      ] =
        await Promise.all([
          supabase.from('profiles').select('id, nome').order('nome'),
          supabase.from('user_roles').select('user_id, role'),
          supabase.from('user_permissions').select('user_id, can_view_ordem_culto'),
          supabase.from('membros_setores').select('profile_id, setor:setores(id, nome)'),
        ]);

      if (profilesError) throw profilesError;

      const permissionsLookup = new Map(
        permissionsError ? [] : (permissionsData || []).map((item) => [item.user_id, item.can_view_ordem_culto]),
      );
      const setoresLookup = new Map<string, Setor[]>();
      if (!membrosSetoresError) {
        (membrosSetoresData || []).forEach((item) => {
          if (!item.setor) return;
          const current = setoresLookup.get(item.profile_id) || [];
          current.push(item.setor as Setor);
          setoresLookup.set(item.profile_id, current);
        });
      }

      const nextUsuarios: UsuarioConfig[] = (profilesData || []).map((profile) => ({
        id: profile.id,
        nome: profile.nome,
        role: (rolesData?.find((item) => item.user_id === profile.id)?.role as 'admin' | 'membro' | undefined) || 'membro',
        canViewOrdemCulto: permissionsLookup.get(profile.id) ?? false,
        setores: setoresLookup.get(profile.id) || [],
      }));

      setUsuarios(nextUsuarios);
    } catch (error) {
      console.error('Error fetching usuarios config:', error);
      toast({
        title: 'Erro ao carregar permissões',
        description: 'Não consegui buscar os usuários agora.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUsuarios(false);
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
      setNewUserNome('');
      setNewUserEmail('');
      clearPageCache('membros');
      fetchUsuarios();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description:
          error.message === 'Failed to send a request to the Edge Function'
            ? 'A função admin-create-user ainda não está publicada no Supabase. Publique a Edge Function para criar usuários já confirmados.'
            : error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleCreateSetor = async () => {
    const nome = novoSetorNome.trim();

    if (!nome) {
      toast({
        title: 'Informe o nome',
        description: 'Digite o nome do ministério.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingSetor(true);
    try {
      const { error } = await supabase.from('setores').insert({ nome });
      if (error) throw error;

      toast({ title: 'Ministério criado!' });
      setNovoSetorNome('');
      clearPageCache('membros');
      fetchSetores();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar ministério',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingSetor(false);
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: 'admin' | 'membro') => {
    setUpdatingRoleId(targetUserId);
    try {
      await supabase.from('user_roles').delete().eq('user_id', targetUserId);
      const { error } = await supabase.from('user_roles').insert({
        user_id: targetUserId,
        role: newRole,
      });

      if (error) throw error;

      setUsuarios((current) =>
        current.map((usuario) => (usuario.id === targetUserId ? { ...usuario, role: newRole } : usuario)),
      );

      toast({ title: 'Permissão de perfil atualizada!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
      fetchUsuarios();
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleToggleOrdemCultoPermission = async (targetUserId: string, nextValue: boolean) => {
    setUpdatingPermissionId(targetUserId);
    try {
      const { error } = await supabase.from('user_permissions').upsert(
        {
          user_id: targetUserId,
          can_view_ordem_culto: nextValue,
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;

      setUsuarios((current) =>
        current.map((usuario) =>
          usuario.id === targetUserId ? { ...usuario, canViewOrdemCulto: nextValue } : usuario,
        ),
      );

      toast({ title: 'Permissão atualizada!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar permissão',
        description:
          error.message?.includes('user_permissions')
            ? 'A nova estrutura de permissões ainda não foi aplicada no banco. Rode a migration para liberar esse controle.'
            : error.message,
        variant: 'destructive',
      });
      fetchUsuarios();
    } finally {
      setUpdatingPermissionId(null);
    }
  };

  const handleAddSetorToUsuario = async (targetUserId: string, setorId: string) => {
    if (!setorId) return;
    setUpdatingSetorUserId(targetUserId);
    try {
      const { error } = await supabase.from('membros_setores').insert({
        profile_id: targetUserId,
        setor_id: setorId,
      });

      if (error) throw error;

      const setor = setores.find((item) => item.id === setorId);
      if (setor) {
        setUsuarios((current) =>
          current.map((usuario) =>
            usuario.id === targetUserId
              ? { ...usuario, setores: [...usuario.setores, setor].sort((a, b) => a.nome.localeCompare(b.nome)) }
              : usuario,
          ),
        );
      }

      toast({ title: 'Ministério vinculado!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao vincular ministério',
        description: error.message,
        variant: 'destructive',
      });
      fetchUsuarios();
    } finally {
      setUpdatingSetorUserId(null);
    }
  };

  const handleRemoveSetorFromUsuario = async (targetUserId: string, setorId: string) => {
    setUpdatingSetorUserId(targetUserId);
    try {
      const { error } = await supabase
        .from('membros_setores')
        .delete()
        .eq('profile_id', targetUserId)
        .eq('setor_id', setorId);

      if (error) throw error;

      setUsuarios((current) =>
        current.map((usuario) =>
          usuario.id === targetUserId
            ? { ...usuario, setores: usuario.setores.filter((setor) => setor.id !== setorId) }
            : usuario,
        ),
      );

      toast({ title: 'Ministério removido!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover ministério',
        description: error.message,
        variant: 'destructive',
      });
      fetchUsuarios();
    } finally {
      setUpdatingSetorUserId(null);
    }
  };

  const filteredUsuarios = useMemo(
    () =>
      usuarios.filter((usuario) =>
        usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [usuarios, searchTerm],
  );

  const selectedUsuario = useMemo(
    () => usuarios.find((usuario) => usuario.id === selectedUsuarioId) || null,
    [usuarios, selectedUsuarioId],
  );

  const adminCount = usuarios.filter((usuario) => usuario.role === 'admin').length;
  const ordemCultoAccessCount = usuarios.filter((usuario) => usuario.canViewOrdemCulto || usuario.role === 'admin').length;
  const usuariosSemMinisterioCount = usuarios.filter((usuario) => usuario.setores.length === 0).length;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const availableSetoresForSelectedUsuario = selectedUsuario
    ? setores.filter((setor) => !selectedUsuario.setores.some((currentSetor) => currentSetor.id === setor.id))
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
      <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:p-4 lg:p-8">
        <div className="animate-fade-in overflow-hidden rounded-2xl border bg-card shadow-lg">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Settings className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Administração</p>
                <h1 className="mt-1 text-2xl font-bold text-foreground lg:text-3xl">
                  Configurações do Harmonic
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                  Gerencie acessos, permissões e ministérios em uma área única, com os controles principais sempre à vista.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <div className="rounded-xl border bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Usuários</p>
                <p className="mt-1 text-2xl font-semibold">{usuarios.length}</p>
              </div>
              <div className="rounded-xl border bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Admins</p>
                <p className="mt-1 text-2xl font-semibold">{adminCount}</p>
              </div>
              <div className="rounded-xl border bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Ministérios</p>
                <p className="mt-1 text-2xl font-semibold">{setores.length}</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="visao" className="animate-slide-up space-y-5">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto w-max min-w-full justify-start rounded-xl p-1 sm:w-auto sm:min-w-0">
              <TabsTrigger value="visao" className="gap-2 rounded-lg px-4 py-2">
                <Settings className="h-4 w-4" />
                Visão geral
              </TabsTrigger>
              <TabsTrigger value="usuarios" className="gap-2 rounded-lg px-4 py-2">
                <UserCog className="h-4 w-4" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="ministerios" className="gap-2 rounded-lg px-4 py-2">
                <Building2 className="h-4 w-4" />
                Ministérios
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="visao" className="mt-0 space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="shadow-md">
                <CardContent className="flex min-h-[124px] items-start gap-4 p-5">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Usuários cadastrados</p>
                    <p className="mt-2 text-3xl font-semibold">{usuarios.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-md">
                <CardContent className="flex min-h-[124px] items-start gap-4 p-5">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Administradores</p>
                    <p className="mt-2 text-3xl font-semibold">{adminCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-md">
                <CardContent className="flex min-h-[124px] items-start gap-4 p-5">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <ListOrdered className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Acesso à OC</p>
                    <p className="mt-2 text-3xl font-semibold">{ordemCultoAccessCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-md">
                <CardContent className="flex min-h-[124px] items-start gap-4 p-5">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sem ministério</p>
                    <p className="mt-2 text-3xl font-semibold">{usuariosSemMinisterioCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Criar acesso
                  </CardTitle>
                  <CardDescription>
                    Cadastre uma pessoa e entregue a senha temporária para o primeiro login.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nome-usuario">Nome completo</Label>
                      <Input
                        id="nome-usuario"
                        placeholder="Ex: Ana Souza"
                        value={newUserNome}
                        onChange={(e) => setNewUserNome(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-usuario">Email</Label>
                      <Input
                        id="email-usuario"
                        type="email"
                        placeholder="ana@email.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Senha inicial: <span className="font-medium text-foreground">{SENHA_PADRAO}</span>
                    </span>
                    <Badge variant="outline" className="w-fit bg-background">
                      Troca obrigatória no primeiro login
                    </Badge>
                  </div>

                  <Button className="w-full sm:w-auto" variant="gradient" onClick={handleCreateUser} disabled={isCreatingUser}>
                    {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Criar usuário
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <KeyRound className="h-5 w-5 text-primary" />
                    Regras de acesso
                  </CardTitle>
                  <CardDescription>
                    Como as permissões desta tela afetam o menu do app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border bg-background p-4">
                    <p className="font-medium text-foreground">Administrador</p>
                    <p className="mt-1">Pode gerenciar usuários, membros, músicas, escalas e configurações.</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="font-medium text-foreground">Acesso à OC</p>
                    <p className="mt-1">Libera a área de Ordem de Culto sem transformar o membro em administrador.</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="font-medium text-foreground">Ministérios</p>
                    <p className="mt-1">Define em quais escalas o usuário aparece como opção.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usuarios" className="mt-0">
            <Card className="shadow-md">
              <CardHeader className="gap-4 border-b bg-secondary/20 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <UserCog className="h-5 w-5 text-primary" />
                    Usuários e permissões
                  </CardTitle>
                  <CardDescription>
                    Abra um usuário para alterar perfil, acesso à OC e ministérios vinculados.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingUsuarios ? (
                  <div className="space-y-3 p-4 sm:p-6">
                    {[1, 2, 3, 4].map((item) => (
                      <Skeleton key={item} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : filteredUsuarios.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredUsuarios.map((usuario) => {
                      const isSelf = usuario.id === user?.id;
                      const hasOrdemCultoAccess = usuario.canViewOrdemCulto || usuario.role === 'admin';
                      return (
                        <button
                          key={usuario.id}
                          type="button"
                          onClick={() => {
                            setSelectedUsuarioId(usuario.id);
                            setIsUserDialogOpen(true);
                          }}
                          className="grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6"
                        >
                          <div className="flex min-w-0 gap-3">
                            <Avatar className="h-11 w-11">
                              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                                {getInitials(usuario.nome)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium">{usuario.nome}</p>
                                {isSelf && <Badge variant="outline">Você</Badge>}
                                {usuario.role === 'admin' && (
                                  <Badge className="border-0 bg-primary/10 text-primary">
                                    <Shield className="h-3 w-3" />
                                    Admin
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant={hasOrdemCultoAccess ? 'secondary' : 'outline'} className="gap-1">
                                  {hasOrdemCultoAccess ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                  {hasOrdemCultoAccess ? 'OC liberada' : 'OC bloqueada'}
                                </Badge>
                                {usuario.setores.length === 0 ? (
                                  <Badge variant="outline">Sem ministério</Badge>
                                ) : (
                                  usuario.setores.slice(0, 3).map((setor) => (
                                    <Badge key={setor.id} variant="secondary">
                                      {setor.nome}
                                    </Badge>
                                  ))
                                )}
                                {usuario.setores.length > 3 && (
                                  <Badge variant="outline">+{usuario.setores.length - 3}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <span className="text-sm text-muted-foreground">Gerenciar</span>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ministerios" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Plus className="h-5 w-5 text-primary" />
                    Novo ministério
                  </CardTitle>
                  <CardDescription>
                    Crie opções que serão usadas nos membros e nas escalas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="novo-ministerio">Nome do ministério</Label>
                    <Input
                      id="novo-ministerio"
                      placeholder="Ex: Louvor Kids"
                      value={novoSetorNome}
                      onChange={(e) => setNovoSetorNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateSetor();
                        }
                      }}
                    />
                  </div>
                  <Button className="w-full" onClick={handleCreateSetor} disabled={isCreatingSetor}>
                    {isCreatingSetor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Criar ministério
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader className="border-b bg-secondary/20">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="h-5 w-5 text-primary" />
                    Ministérios cadastrados
                  </CardTitle>
                  <CardDescription>
                    {setores.length} ministério{setores.length === 1 ? '' : 's'} disponível{setores.length === 1 ? '' : 'is'} para vínculo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {[1, 2, 3, 4, 5, 6].map((item) => (
                        <Skeleton key={item} className="h-14 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : setores.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-background px-4 py-12 text-center text-sm text-muted-foreground">
                      Nenhum ministério cadastrado ainda.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {setores.map((setor) => (
                        <div key={setor.id} className="flex min-h-[56px] items-center gap-3 rounded-xl border bg-background px-4 py-3">
                          <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span className="min-w-0 truncate text-sm font-medium">{setor.nome}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 pr-6 text-xl">
                {selectedUsuario && (
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(selectedUsuario.nome)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span>{selectedUsuario ? selectedUsuario.nome : 'Gerenciar usuário'}</span>
              </DialogTitle>
              <DialogDescription>
                Ajuste o nível de acesso e os ministérios vinculados a este usuário.
              </DialogDescription>
            </DialogHeader>
            {selectedUsuario && (
              <div className="mt-4 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <Select
                      value={selectedUsuario.role}
                      onValueChange={(value) => handleChangeRole(selectedUsuario.id, value as 'admin' | 'membro')}
                      disabled={updatingRoleId === selectedUsuario.id || selectedUsuario.id === user?.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="membro">Membro</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Acesso à OC</Label>
                    <div className="flex h-10 items-center justify-between rounded-md border px-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {selectedUsuario.canViewOrdemCulto || selectedUsuario.role === 'admin' ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        {selectedUsuario.canViewOrdemCulto || selectedUsuario.role === 'admin' ? 'Liberado' : 'Bloqueado'}
                      </span>
                      <Switch
                        checked={selectedUsuario.canViewOrdemCulto || selectedUsuario.role === 'admin'}
                        onCheckedChange={(checked) => handleToggleOrdemCultoPermission(selectedUsuario.id, checked)}
                        disabled={updatingPermissionId === selectedUsuario.id || selectedUsuario.role === 'admin'}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label>Ministérios</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      O usuário só aparece como opção nas escalas desses ministérios.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsuario.setores.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nenhum ministério vinculado.</span>
                    ) : (
                      selectedUsuario.setores.map((setor) => (
                        <Badge key={setor.id} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                          <span>{setor.nome}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-destructive hover:text-destructive hover:bg-transparent"
                            disabled={updatingSetorUserId === selectedUsuario.id}
                            onClick={() => handleRemoveSetorFromUsuario(selectedUsuario.id, setor.id)}
                          >
                            <span className="sr-only">Remover</span>
                            <Plus className="h-3 w-3 rotate-45" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>

                  <Select
                    value=""
                    onValueChange={(value) => handleAddSetorToUsuario(selectedUsuario.id, value)}
                    disabled={
                      updatingSetorUserId === selectedUsuario.id ||
                      availableSetoresForSelectedUsuario.length === 0
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          availableSetoresForSelectedUsuario.length === 0
                            ? 'Todos os ministérios já vinculados'
                            : 'Adicionar ministério'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSetoresForSelectedUsuario.map((setor) => (
                        <SelectItem key={setor.id} value={setor.id}>
                          {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
