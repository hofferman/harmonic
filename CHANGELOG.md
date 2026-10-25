# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

### Adicionado
- Cadastro de WhatsApp por membro na tela de Membros, com formatação
  automática e opção de desativar avisos individualmente.
- Aviso automático de escala no WhatsApp via Evolution API, com repertório,
  tom e função de cada pessoa. Líderes recebem o resumo da equipe.
- Licença proprietária, guia de contribuição e templates de issue/PR.
- CI com build, verificação de segredos no diff e auditoria de dependências.
- Workflow de release por tag, com artefato e checksum.

### Alterado
- Backend migrado do Supabase cloud para instância self-hosted.

### Corrigido
- Numeração do repertório começava em zero.
- RLS de `profiles` impedia administradores de editar perfis de terceiros —
  a edição de nome falhava silenciosamente.

---

## [0.1.0] — 2026-09-16

Primeira versão em produção.

### Adicionado
- Gestão de escalas, membros, músicas e ordem de culto.
- Autenticação com papéis (admin/membro) e RLS.
- Tema escuro e interface responsiva.
