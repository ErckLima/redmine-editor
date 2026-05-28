# 📋 Redmine Editor

Editor de texto com formatação Textile/Redmine, preview em tempo real e integração direta com a API do Redmine via backend seguro no Supabase.

---

## Funcionalidades

- **Autenticação por chave API**: cada usuário informa sua chave API do Redmine para acessar a aplicação
- **Busca de demandas reais**: ao criar uma nova demanda, o número é validado diretamente no Redmine e o título é carregado automaticamente
- **Atualizar Redmine**: botão para enviar a descrição editada diretamente para a demanda no Redmine via PUT
- **Editor Textile**: formatação completa compatível com Redmine (negrito, itálico, títulos, listas, tabelas, links, imagens, etc.)
- **Preview em tempo real**: visualização renderizada do conteúdo enquanto edita
- **Múltiplas abas**: trabalhe com várias demandas simultaneamente
- **Tema claro/escuro**: alternância de tema com persistência
- **Armazenamento seguro**: chave API nunca exposta no frontend; token de sessão no `sessionStorage`

---

## Arquitetura de Segurança

```
Frontend (GitHub Pages)
        │
        │  HTTPS (token Supabase)
        ▼
Supabase Edge Functions (proxy seguro)
        │
        │  Chave API do Redmine (armazenada no banco com RLS)
        ▼
API do Redmine (servidor interno)
```

- A **chave API do Redmine** nunca trafega do frontend para o Redmine diretamente
- O frontend recebe apenas um **token de sessão Supabase** (JWT com expiração)
- O token é armazenado no `sessionStorage` (limpo ao fechar o navegador)
- O banco de dados usa **Row Level Security (RLS)**: cada usuário só acessa seus próprios dados

---

## Configuração do Supabase

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Crie um novo projeto
3. Anote a **URL do projeto** e a **Anon Key** (em Settings → API)

### 2. Executar a migração do banco

No painel do Supabase, acesse **SQL Editor** e execute o conteúdo do arquivo:

```
supabase/migrations/20240101000000_create_user_profiles.sql
```

### 3. Fazer deploy das Edge Functions

Instale o [Supabase CLI](https://supabase.com/docs/guides/cli) e execute:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy auth-validate
supabase functions deploy redmine-proxy
```

### 4. Configurar o frontend

No arquivo `index.html`, substitua os placeholders pelas suas credenciais Supabase:

```javascript
var SUPABASE_URL  = 'https://SEU_PROJECT_ID.supabase.co';
var SUPABASE_ANON = 'sua_anon_key_aqui';
```

> **Nota**: A `anon key` é segura para expor no frontend. Ela não dá acesso administrativo ao banco — o RLS garante que cada usuário só acesse seus próprios dados.

### 5. Publicar no GitHub Pages

Faça commit e push das alterações. O GitHub Pages publicará automaticamente o `index.html`.

---

## Uso

1. Acesse a aplicação pelo GitHub Pages
2. Informe sua **chave API do Redmine** (Minha conta → Chave de acesso à API)
3. Clique em **+** para buscar uma demanda pelo número
4. Edite o conteúdo no editor com formatação Textile
5. Clique em **☁ Atualizar Redmine** para salvar a descrição diretamente na demanda

---

## Formatações Suportadas

| Sintaxe         | Resultado         |
|-----------------|-------------------|
| `*texto*`       | **negrito**       |
| `_texto_`       | *itálico*         |
| `+texto+`       | sublinhado        |
| `-texto-`       | riscado           |
| `h1. Título`    | Título nível 1    |
| `h2. Título`    | Título nível 2    |
| `* item`        | Lista bullets     |
| `# item`        | Lista numerada    |
| `bq. texto`     | Citação           |
| `---`           | Linha horizontal  |
| `"texto":url`   | Link externo      |
| `#123`          | Link para issue   |

---

## Atalhos de Teclado

| Atalho     | Ação                |
|------------|---------------------|
| `Ctrl+B`   | Negrito             |
| `Ctrl+I`   | Itálico             |
| `Ctrl+U`   | Sublinhado          |
| `Ctrl+S`   | Riscado             |
| `Ctrl+T`   | Tabela              |
| `Ctrl+M`   | Marcador de imagem  |
