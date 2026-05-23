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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { clearPageCache } from '@/lib/pageCache';
import { Settings, UserPlus, Users, Loader2, Plus, KeyRound, ListOrdered, ChevronRight, ChevronDown, Shield } from 'lucide-react';

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
  const [isUsuariosExpanded, setIsUsuariosExpanded] = useState(false);

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4 sm:p-4 lg:p-8 space-y-5 sm:space-y-6 max-w-6xl mx-auto">
        <div className="animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
                Configurações
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Central administrativa para usuários, ministérios e permissões.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="border-0 shadow-lg animate-slide-up">
              <CardHeader className="border-b bg-secondary/20">
                <CardTitle className="font-serif flex items-center gap-2 text-xl">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Permissões dos usuários
                </CardTitle>
                <CardDescription>
                  Defina quem é administrador e quem pode acessar a área de OC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {usuarios.filter((usuario) => usuario.role === 'admin').length} admins
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {usuarios.filter((usuario) => usuario.canViewOrdemCulto || usuario.role === 'admin').length} com acesso
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between sm:w-auto"
                    onClick={() => setIsUsuariosExpanded((current) => !current)}
                  >
                    {isUsuariosExpanded ? 'Ocultar usuários' : 'Mostrar usuários'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isUsuariosExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {isUsuariosExpanded && (
                  <Input
                    placeholder="Buscar usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="sm:max-w-sm"
                  />
                )}

                {isUsuariosExpanded ? (
                  isLoadingUsuarios ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <Skeleton key={item} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                  ) : filteredUsuarios.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-secondary/20 px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </div>
                  ) : (
                  <div className="space-y-3">
                    {filteredUsuarios.map((usuario) => {
                      const isSelf = usuario.id === user?.id;
                      return (
                        <button
                          key={usuario.id}
                          type="button"
                          onClick={() => {
                            setSelectedUsuarioId(usuario.id);
                            setIsUserDialogOpen(true);
                          }}
                          className="w-full rounded-xl border bg-background px-4 py-4 text-left transition-colors hover:bg-secondary/10"
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium">{usuario.nome}</p>
                                {isSelf && <Badge variant="outline">Você</Badge>}
                                {usuario.role === 'admin' && (
                                  <Badge className="bg-primary/10 text-primary border-0">
                                    <Shield className="mr-1 h-3 w-3" />
                                    Admin
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <ListOrdered className="h-3.5 w-3.5" />
                                  {usuario.canViewOrdemCulto || usuario.role === 'admin' ? 'Acesso à OC liberado' : 'Sem acesso à OC'}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {usuario.setores.length === 0 ? (
                                  <span className="text-sm text-muted-foreground">Nenhum ministério vinculado.</span>
                                ) : (
                                  usuario.setores.map((setor) => (
                                    <Badge key={setor.id} variant="secondary" className="px-2 py-1 text-xs">
                                      {setor.nome}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  )
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.05s' }}>
              <CardHeader className="border-b bg-secondary/20">
                <CardTitle className="font-serif flex items-center gap-2 text-xl">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Criar usuário
                </CardTitle>
                <CardDescription>
                  Use esta área para cadastrar novos acessos administrativos ou de membros.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nome-usuario">Nome</Label>
                    <Input
                      id="nome-usuario"
                      placeholder="Nome completo"
                      value={newUserNome}
                      onChange={(e) => setNewUserNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-usuario">Email</Label>
                    <Input
                      id="email-usuario"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-secondary/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  Senha inicial padrão: <span className="font-medium text-foreground">{SENHA_PADRAO}</span>. No primeiro login, o usuário será obrigado a criar uma nova senha.
                </div>

                <div className="flex justify-end">
                  <Button className="w-full sm:w-auto" variant="gradient" onClick={handleCreateUser} disabled={isCreatingUser}>
                    {isCreatingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Criar usuário
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="border-b bg-secondary/20">
                <CardTitle className="font-serif flex items-center gap-2 text-xl">
                  <Users className="h-5 w-5 text-primary" />
                  Ministérios
                </CardTitle>
                <CardDescription>
                  Cadastre os ministérios que poderão ser usados nas escalas e nos membros.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="novo-ministerio">Novo ministério</Label>
                    <Input
                      id="novo-ministerio"
                      placeholder="Ex: Farol, Acesso, Louvor Kids"
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
                  <div className="sm:self-end">
                    <Button className="w-full sm:w-auto" onClick={handleCreateSetor} disabled={isCreatingSetor}>
                      {isCreatingSetor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Criar ministério
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Ministérios cadastrados</p>
                    <p className="text-sm text-muted-foreground">Essa lista já alimenta as escalas e a associação com membros.</p>
                  </div>

                  {isLoading ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[1, 2, 3, 4].map((item) => (
                        <Skeleton key={item} className="h-10 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {setores.map((setor) => (
                        <Badge key={setor.id} variant="secondary" className="px-3 py-1 text-sm">
                          {setor.nome}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
            <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <CardHeader className="border-b bg-secondary/20 pb-4">
                <CardTitle className="font-serif text-xl">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-1 sm:p-6">
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Admins</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {usuarios.filter((usuario) => usuario.role === 'admin').length}
                  </p>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Acesso à OC</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {usuarios.filter((usuario) => usuario.canViewOrdemCulto || usuario.role === 'admin').length}
                  </p>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ministérios</p>
                  <p className="mt-1 text-2xl font-semibold">{setores.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="border-b bg-secondary/20 pb-4">
                <CardTitle className="font-serif text-xl">Acesso à OC</CardTitle>
                <CardDescription>
                  Admin já tem acesso automático. Use a chave só para membros que precisam visualizar.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="rounded-xl border bg-secondary/20 px-4 py-4 text-sm text-muted-foreground">
                  Quem receber essa permissão verá a área de <span className="font-medium text-foreground">OC</span> no menu e poderá abrir ordens publicadas, sem ganhar acesso administrativo ao restante do sistema.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif">
                {selectedUsuario ? `Gerenciar ${selectedUsuario.nome}` : 'Gerenciar usuário'}
              </DialogTitle>
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
                      <span className="text-sm text-muted-foreground">
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
                      setores.filter((setor) => !selectedUsuario.setores.some((currentSetor) => currentSetor.id === setor.id)).length === 0
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          setores.filter((setor) => !selectedUsuario.setores.some((currentSetor) => currentSetor.id === setor.id)).length === 0
                            ? 'Todos os ministérios já vinculados'
                            : 'Adicionar ministério'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {setores
                        .filter((setor) => !selectedUsuario.setores.some((currentSetor) => currentSetor.id === setor.id))
                        .map((setor) => (
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
