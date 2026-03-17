# Nexla OPS

Plataforma de atendimento via WhatsApp com suporte a múltiplos atendentes, departamentos e gestão de contatos.

## Stack

- **React 18** + **TypeScript**
- **Vite** — build e dev server
- **Tailwind CSS** — estilização
- **Supabase** — banco de dados (PostgreSQL), autenticação e realtime
- **Lucide React** — ícones

## Funcionalidades

- **Dashboard da Companhia** — visão completa de conversas, contatos e configurações
- **Dashboard do Atendente** — interface dedicada por atendente com filtro por departamento
- **Gestão de Contatos** — add, editar e excluir contatos com seletor de DDI internacional
- **Filtros de conversa** — Abertos / Fechados / Todos / por Departamento
- **Iniciar Conversa** — botão para contatos sem histórico de mensagens
- **Transferência de conversa** — entre departamentos com registro de histórico
- **Modo claro/escuro** — suporte a tema no dashboard da companhia
- **Realtime** — mensagens e contatos atualizados em tempo real via Supabase
- **Super Admin** — painel de administração global

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

## Instalação

```bash
npm install
```

Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Banco de Dados

As migrations estão em [`supabase/migrations/`](supabase/migrations/). Para aplicar:

```bash
supabase db push
```

> Após qualquer nova migration, execute também pelo **SQL Editor** do Supabase Dashboard caso o CLI não esteja configurado.

## Estrutura

```
src/
├── components/        # Dashboards e componentes principais
├── contexts/          # AuthContext, ThemeContext
├── lib/               # Cliente Supabase e tipos globais
└── assets/            # Imagens e ícones
supabase/
└── migrations/        # Histórico de migrations do banco
public/
└── favicon.svg / favicon.png
```
