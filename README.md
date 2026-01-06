# Harmonic 🎵

Sistema de gestão de escalas e músicas para ministérios de louvor. Gerencie escalas, membros, repertório e muito mais de forma simples e organizada.

## ✨ Funcionalidades

- 📅 **Gestão de Escalas**: Crie e gerencie escalas de culto com facilidade
- 👥 **Gestão de Membros**: Organize sua equipe e suas funções
- 🎶 **Catálogo de Músicas**: Mantenha um repertório completo com tom, artista e links
- 🔐 **Autenticação**: Sistema de login seguro com roles (admin/membro)
- 🌓 **Dark Mode**: Interface com suporte a tema claro e escuro
- 📱 **Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- ⚡ **Performance**: Construído com as melhores práticas de React e TypeScript

## 🚀 Tecnologias

Este projeto utiliza as seguintes tecnologias:

- **React 18** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Tipagem estática para JavaScript
- **Vite** - Build tool e dev server extremamente rápido
- **Tailwind CSS** - Framework CSS utility-first
- **shadcn/ui** - Componentes UI construídos com Radix UI
- **Supabase** - Backend como serviço (autenticação e banco de dados)
- **React Router** - Roteamento para aplicações React
- **React Query** - Gerenciamento de estado do servidor
- **React Hook Form** - Formulários performáticos
- **Zod** - Validação de schemas TypeScript-first
- **date-fns** - Manipulação de datas
- **Lucide React** - Ícones modernos e leves

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:

- **Node.js** 18+ ([instalar com nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **npm** ou **yarn** ou **bun**
- Uma conta no **Supabase** (para banco de dados e autenticação)

## 🛠️ Instalação

1. **Clone o repositório**
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd harmonic
   ```

2. **Instale as dependências**
   ```bash
   npm install
   # ou
   yarn install
   # ou
   bun install
   ```

3. **Configure as variáveis de ambiente**
   
   Crie um arquivo `.env` na raiz do projeto:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-public
   ```
   
   > **Nota**: Você pode obter essas credenciais no dashboard do Supabase em Settings > API

4. **Configure o banco de dados**
   
   Execute as migrations do Supabase na pasta `supabase/migrations/`:
   ```bash
   # Se você tem Supabase CLI instalado
   supabase db push
   
   # Ou execute manualmente no SQL Editor do Supabase
   ```

5. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   # ou
   yarn dev
   # ou
   bun dev
   ```

   A aplicação estará disponível em `http://localhost:8080`

## 📁 Estrutura do Projeto

```
harmonic/
├── public/                 # Arquivos estáticos
├── src/
│   ├── components/         # Componentes React
│   │   ├── layout/        # Componentes de layout
│   │   └── ui/            # Componentes UI (shadcn)
│   ├── hooks/             # Custom hooks
│   ├── integrations/      # Integrações (Supabase)
│   ├── lib/               # Utilitários
│   ├── pages/             # Páginas da aplicação
│   ├── App.tsx            # Componente principal
│   └── main.tsx           # Entry point
├── supabase/
│   └── migrations/        # Migrations do banco de dados
├── .env                   # Variáveis de ambiente (não commitado)
└── package.json
```

## 🎯 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run build:dev` - Cria build em modo desenvolvimento
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa o linter

## 🔐 Autenticação e Roles

O sistema possui dois tipos de usuários:

- **Admin**: Acesso total ao sistema (criar/editar/deletar escalas, membros e músicas)
- **Membro**: Visualiza apenas suas escalas e informações pessoais

## 🗄️ Banco de Dados

O projeto usa **Supabase** (PostgreSQL) com as seguintes tabelas principais:

- `profiles` - Perfis de usuários
- `user_roles` - Roles dos usuários
- `escalas` - Escalas de culto
- `escala_membros` - Membros em cada escala
- `escala_musicas` - Músicas de cada escala
- `musicas` - Catálogo de músicas
- `membros_funcoes` - Funções dos membros

## 🚢 Deploy

### Vercel

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy automático a cada push

### Netlify

1. Conecte seu repositório ao Netlify
2. Configure as variáveis de ambiente
3. Build command: `npm run build`
4. Publish directory: `dist`

### Outros

O projeto gera arquivos estáticos na pasta `dist/` após o build, podendo ser hospedado em qualquer serviço de hospedagem estática.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

## 📝 Licença

Este projeto é privado e de uso pessoal.

## 👤 Autor

Desenvolvido com ❤️ para servir a igreja

---

**Harmonic** - Gerencie escalas, músicas e sua equipe de forma simples e organizada.
