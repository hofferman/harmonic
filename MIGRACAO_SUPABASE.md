# Guia de Migração: Lovable Cloud → Supabase

Este projeto já está **100% configurado para usar Supabase**! Você só precisa configurar suas credenciais e executar as migrations.

## 📋 Passo a Passo

### 1. Criar um Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha:
   - **Name**: Harmonic (ou o nome que preferir)
   - **Database Password**: Crie uma senha forte (anote ela!)
   - **Region**: Escolha a região mais próxima
5. Aguarde o projeto ser criado (pode levar alguns minutos)

### 2. Obter as Credenciais do Supabase

1. No dashboard do Supabase, vá em **Settings** → **API**
2. Você encontrará:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon/public key** (chave pública)
   - **service_role key** (chave privada - mantenha segura!)

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (se ainda não existir):

```bash
# .env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-public-aqui
```

**Importante**: 
- Substitua `https://seu-projeto.supabase.co` pela sua Project URL
- Substitua `sua-chave-anon-public-aqui` pela sua anon/public key
- **NUNCA** commite o arquivo `.env` no Git (já está no `.gitignore`)

### 4. Executar as Migrations

O projeto já tem migrations prontas na pasta `supabase/migrations/`. Você tem duas opções:

#### Opção A: Usando Supabase CLI (Recomendado)

1. **Instalar Supabase CLI**:
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # ou usando npm
   npm install -g supabase
   ```

2. **Fazer login**:
   ```bash
   supabase login
   ```

3. **Linkar o projeto**:
   ```bash
   supabase link --project-ref seu-project-id
   ```
   (O project-id está no arquivo `supabase/config.toml` ou você pode encontrar no dashboard do Supabase)

4. **Executar migrations**:
   ```bash
   supabase db push
   ```

#### Opção B: Executar Manualmente no Dashboard

1. Acesse o dashboard do Supabase
2. Vá em **SQL Editor**
3. Execute cada arquivo SQL da pasta `supabase/migrations/` na ordem:
   - `20260105163451_f81d3535-3cfc-49c7-b3df-3a7025193982.sql`
   - `20260105165214_7270a1cb-1e3c-4f74-a4da-9b438668014d.sql`
   - `20260105172515_ee5cda26-57b9-42a3-b872-18dfecaa397e.sql`

### 5. Row Level Security (RLS) ✅

**Boa notícia!** As migrations já incluem todas as políticas de Row Level Security (RLS) necessárias. Você não precisa fazer nada adicional - as políticas já foram criadas automaticamente quando você executou as migrations.

As políticas configuradas incluem:
- ✅ Usuários podem ver todos os perfis
- ✅ Usuários podem atualizar seu próprio perfil
- ✅ Admins têm acesso total a todas as tabelas
- ✅ Membros podem ver apenas as escalas em que participam
- ✅ Funções auxiliares para verificar roles e membros de escalas

### 6. Criar o Primeiro Usuário Admin

Após configurar tudo, você precisa criar seu primeiro usuário:

1. No dashboard do Supabase, vá em **Authentication** → **Users**
2. Clique em **"Add user"** → **"Create new user"**
3. Preencha email e senha
4. Após criar, vá em **SQL Editor** e execute:

```sql
-- Substitua 'email-do-usuario@exemplo.com' pelo email que você criou
INSERT INTO profiles (id, nome)
SELECT id, raw_user_meta_data->>'nome' as nome
FROM auth.users
WHERE email = 'email-do-usuario@exemplo.com'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- Tornar o usuário admin
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'email-do-usuario@exemplo.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

### 7. Testar a Aplicação

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Acesse a aplicação e faça login com o usuário que você criou

3. Verifique se tudo está funcionando corretamente

## 🔧 Estrutura do Banco de Dados

O projeto usa as seguintes tabelas:

- **profiles**: Perfis de usuários
- **user_roles**: Roles dos usuários (admin/membro)
- **escalas**: Escalas de culto
- **escala_membros**: Membros em cada escala
- **escala_musicas**: Músicas de cada escala
- **musicas**: Catálogo de músicas
- **membros_funcoes**: Funções dos membros (ex: Bateria, Guitarra, etc.)

## 📝 Notas Importantes

1. **Backup**: Antes de migrar, faça backup dos dados do Lovable Cloud (se houver)

2. **Migração de Dados**: Se você já tem dados no Lovable Cloud, você precisará exportá-los e importá-los manualmente no Supabase

3. **Variáveis de Ambiente**: Nunca commite o arquivo `.env` - ele já está no `.gitignore`

4. **Produção**: Para produção, configure as variáveis de ambiente na plataforma de deploy (Vercel, Netlify, etc.)

## 🆘 Troubleshooting

### Erro: "Invalid API key"
- Verifique se as variáveis de ambiente estão corretas
- Certifique-se de usar a chave **anon/public**, não a service_role

### Erro: "relation does not exist"
- Execute as migrations primeiro
- Verifique se todas as migrations foram executadas na ordem correta

### Erro de permissão ao criar usuário
- Verifique as políticas RLS
- Certifique-se de que as políticas foram criadas corretamente

## ✅ Checklist de Migração

- [ ] Projeto criado no Supabase
- [ ] Variáveis de ambiente configuradas no `.env`
- [ ] Migrations executadas
- [ ] Políticas RLS configuradas
- [ ] Primeiro usuário admin criado
- [ ] Aplicação testada localmente
- [ ] Variáveis de ambiente configuradas no ambiente de produção

## 🎉 Pronto!

Agora seu projeto está usando Supabase! Você tem controle total sobre o banco de dados e não depende mais do Lovable Cloud.

