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
import { Users, Plus, Trash2, Shield, User, Music } from 'lucide-react';

interface MembroFuncao {
  id: string;
  funcao: string;
}

interface Membro {
  id: string;
  nome: string;
  created_at: string;
  role?: 'admin' | 'membro';
  funcoes: MembroFuncao[];
}

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

  // Change role dialog
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [roleMembroId, setRoleMembroId] = useState<string | null>(null);

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
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, created_at')
        .order('nome');

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
                          <h3 className="font-semibold text-lg">{membro.nome}</h3>
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
