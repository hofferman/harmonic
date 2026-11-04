import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  Phone,
  Loader2,
  Copy,
  Check,
  X,
  MessageCircle,
  Clock,
  UserPlus,
  Send,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Invitation {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  token: string;
}

// Normaliza telefone para formato internacional 55DDDNNNNNNNNN
const normalizarTelefone = (bruto: string): string | null => {
  const d = (bruto || '').replace(/\D/g, '');
  if (!d) return null;
  const comPais = d.startsWith('55') ? d : `55${d}`;
  return /^55[1-9][0-9]{9,10}$/.test(comPais) ? comPais : null;
};

const formatarTelefone = (tel?: string | null): string => {
  if (!tel) return '';
  const d = tel.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
};

export default function InvitationManagement() {
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create invitation form
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Created invitation result
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [createdInviteId, setCreatedInviteId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Sending WhatsApp
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  
  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Erro',
        description: 'Não consegui carregar os convites.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    const nome = newNome.trim();
    const email = newEmail.trim().toLowerCase();
    const telefone = newTelefone.trim();

    if (!nome || !email) {
      toast({
        title: 'Preencha os dados',
        description: 'Nome e email são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    // Validate telefone if provided
    if (telefone && !normalizarTelefone(telefone)) {
      toast({
        title: 'Telefone inválido',
        description: 'Use DDD + número, ex: (11) 98765-4321.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-invitation', {
        body: { nome, email, telefone: telefone || null },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Convite criado!',
        description: 'Copie o link ou envie por WhatsApp.',
      });

      setCreatedInviteUrl(data.inviteUrl);
      setCreatedInviteId(data.invitation.id);
      setNewNome('');
      setNewEmail('');
      setNewTelefone('');
      fetchInvitations();
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast({
        title: 'Erro ao criar convite',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione e copie manualmente.',
        variant: 'destructive',
      });
    }
  };

  const handleSendWhatsApp = async (invitation: Invitation) => {
    if (!invitation.telefone) {
      toast({
        title: 'Sem telefone',
        description: 'Este convite não possui WhatsApp cadastrado.',
        variant: 'destructive',
      });
      return;
    }

    setSendingWhatsAppId(invitation.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-invitation', {
        body: { invitationId: invitation.id },
      });

      if (error) throw error;

      if (data.error) {
        // Check for Evolution not configured
        if (data.code === 'EVOLUTION_NOT_CONFIGURED') {
          toast({
            title: 'WhatsApp não configurado',
            description: 'Configure a Evolution API nas variáveis de ambiente.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao enviar',
            description: data.error,
            variant: 'destructive',
          });
        }
        return;
      }

      toast({
        title: 'WhatsApp enviado!',
        description: `Convite enviado para ${formatarTelefone(invitation.telefone)}`,
      });
    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      toast({
        title: 'Erro ao enviar WhatsApp',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  const handleDeleteInvitation = async (invitation: Invitation) => {
    if (invitation.accepted_at) return; // Can't delete accepted invitations
    
    const confirmed = window.confirm(
      `Cancelar o convite para ${invitation.nome}?`
    );
    if (!confirmed) return;

    setDeletingId(invitation.id);
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitation.id);

      if (error) throw error;

      toast({ title: 'Convite cancelado' });
      fetchInvitations();
    } catch (error: any) {
      console.error('Error deleting invitation:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const pendingInvitations = invitations.filter(i => !i.accepted_at);
  const acceptedInvitations = invitations.filter(i => i.accepted_at);

  const getInviteUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/aceitar-convite?token=${token}`;
  };

  return (
    <div className="space-y-5">
      {/* Create Invitation Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5 text-primary" />
            Convidar novo usuário
          </CardTitle>
          <CardDescription>
            Crie um convite e envie por WhatsApp. O convidado define sua própria senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="gradient" onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Criar convite
          </Button>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-secondary/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-primary" />
            Convites pendentes
          </CardTitle>
          <CardDescription>
            {pendingInvitations.length} convite{pendingInvitations.length !== 1 ? 's' : ''} aguardando aceitação
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : pendingInvitations.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhum convite pendente.
            </div>
          ) : (
            <div className="divide-y">
              {pendingInvitations.map((invitation) => {
                const isExpired = isPast(new Date(invitation.expires_at));
                return (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{invitation.nome}</p>
                        {isExpired ? (
                          <Badge variant="destructive">Expirado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-3">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {invitation.email}
                        </span>
                        {invitation.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {formatarTelefone(invitation.telefone)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Criado {formatDistanceToNow(new Date(invitation.created_at), { locale: ptBR, addSuffix: true })}
                        {!isExpired && (
                          <> · Expira {format(new Date(invitation.expires_at), "dd/MM 'às' HH:mm")}</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(getInviteUrl(invitation.token))}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Copiar link
                      </Button>
                      {invitation.telefone && !isExpired && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendWhatsApp(invitation)}
                          disabled={sendingWhatsAppId === invitation.id}
                        >
                          {sendingWhatsAppId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageCircle className="h-4 w-4" />
                          )}
                          WhatsApp
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteInvitation(invitation)}
                        disabled={deletingId === invitation.id}
                      >
                        {deletingId === invitation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accepted Invitations */}
      {acceptedInvitations.length > 0 && (
        <Card className="shadow-md">
          <CardHeader className="border-b bg-secondary/20">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Check className="h-5 w-5 text-green-600" />
              Convites aceitos
            </CardTitle>
            <CardDescription>
              {acceptedInvitations.length} convite{acceptedInvitations.length !== 1 ? 's' : ''} aceito{acceptedInvitations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {acceptedInvitations.slice(0, 10).map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{invitation.nome}</p>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        <Check className="h-3 w-3" />
                        Aceito
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{invitation.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aceito {formatDistanceToNow(new Date(invitation.accepted_at!), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Invitation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setCreatedInviteUrl(null);
          setCreatedInviteId(null);
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar convite</DialogTitle>
            <DialogDescription>
              {createdInviteUrl
                ? 'Convite criado! Copie o link ou envie por WhatsApp.'
                : 'Preencha os dados do novo usuário para enviar o convite.'}
            </DialogDescription>
          </DialogHeader>

          {createdInviteUrl ? (
            <div className="space-y-4 mt-4">
              <div className="rounded-lg border bg-secondary/30 p-4">
                <p className="text-sm font-medium mb-2">Link do convite:</p>
                <div className="flex gap-2">
                  <Input
                    value={createdInviteUrl}
                    readOnly
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyLink(createdInviteUrl)}
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                {createdInviteId && invitations.find(i => i.id === createdInviteId)?.telefone && (
                  <Button
                    variant="gradient"
                    className="flex-1"
                    onClick={() => {
                      const inv = invitations.find(i => i.id === createdInviteId);
                      if (inv) handleSendWhatsApp(inv);
                    }}
                    disabled={sendingWhatsAppId === createdInviteId}
                  >
                    {sendingWhatsAppId === createdInviteId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar por WhatsApp
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setCreatedInviteUrl(null);
                    setCreatedInviteId(null);
                  }}
                  className={createdInviteId && invitations.find(i => i.id === createdInviteId)?.telefone ? '' : 'flex-1'}
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="invite-nome">Nome completo</Label>
                <Input
                  id="invite-nome"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex: Ana Souza"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ana@email.com"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-telefone">
                  WhatsApp <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="invite-telefone"
                  type="tel"
                  value={newTelefone}
                  onChange={(e) => setNewTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  Se informado, você pode enviar o convite diretamente pelo WhatsApp.
                </p>
              </div>
              <Button
                className="w-full"
                variant="gradient"
                onClick={handleCreateInvitation}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Criar convite
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
