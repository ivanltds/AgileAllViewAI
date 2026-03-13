# AgileAllView

> Azure DevOps analytics dashboard — visibility across all squads.

---

## ⚡ Quick Start

### Opção A — Script automático (recomendado)

```bash
bash setup.sh
npm run dev
```

### Opção B — Passo a passo manual

```bash
# 1. Copiar variáveis de ambiente
cp .env.example .env.local

# 2. Criar pasta do banco (se não existir)
mkdir -p database

# 3. Instalar dependências
npm install

# 4. Inicializar banco SQLite
npx ts-node --project tsconfig.json scripts/initDb.ts

# 5. Iniciar o servidor
npm run dev
```

Acesse: **http://localhost:3000**

---

## 🐳 GitHub Codespaces

Abra o repositório no Codespaces — o `devcontainer.json` executa tudo automaticamente:

```
postCreateCommand: npm install && npx ts-node scripts/initDb.ts
```

A porta 3000 é aberta automaticamente no browser.

---

## 🔑 PAT — Personal Access Token

No Azure DevOps, crie um token em:
**User Settings → Personal Access Tokens → New Token**

Permissões mínimas necessárias:

| Escopo | Permissão |
|--------|-----------|
| Work Items | Read |
| Project and Team | Read |

> O PAT é guardado **somente em memória** (`useRef`).  
> Nunca é escrito no banco, cookie ou localStorage.  
> É limpo automaticamente ao fechar a aba.

---

## 📁 Estrutura de Pastas

```
agileallview/
├── .env.example              ← variáveis de ambiente (copiar para .env.local)
├── setup.sh                  ← script de setup automático
├── database/
│   └── schema.sql            ← schema SQLite (aplicado automaticamente)
├── lib/
│   ├── types.ts              ← todos os tipos TypeScript
│   ├── azure/
│   │   └── connector.ts      ← cliente REST Azure (fetch puro, sem SDK)
│   ├── analytics/
│   │   └── engine.ts         ← Lead Time, Cycle Time, capacidade (funções puras)
│   ├── storage/
│   │   ├── db.ts             ← singleton SQLite (better-sqlite3)
│   │   └── repositories.ts   ← CRUD tipado para cada tabela
│   └── services/
│       └── syncService.ts    ← pipeline completo de ingestão
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← redireciona para /dashboard
│   ├── globals.css
│   ├── dashboard/
│   │   └── page.tsx          ← shell client-side
│   └── api/
│       ├── validate/         ← POST: valida PAT
│       ├── teams/            ← GET/POST/DELETE: gerenciar times
│       ├── sync/             ← POST: sync com SSE (progresso em tempo real)
│       └── metrics/[teamId]/ ← GET: todos os dados do dashboard
├── components/
│   ├── ui/                   ← KpiCard, FlowBar, Badge, Spinner, SyncProgress
│   └── dashboard/
│       ├── SessionScreen.tsx
│       ├── Topbar.tsx
│       ├── HomeScreen.tsx
│       ├── Dashboard.tsx
│       └── tabs/             ← Overview, Backlog, Sprints, Capacity, Simulation
└── scripts/
    └── initDb.ts             ← cria o banco de dados
```

---

## 🔄 Fluxo de Dados

```
Azure DevOps API
      ↓  (PAT apenas em memória)
lib/azure/connector.ts
      ↓
lib/services/syncService.ts   ← progresso via SSE
      ↓
SQLite (database/agileallview.db)
  ├── work_items
  ├── revisions          ← cache permanente (nunca reprocessado)
  ├── metrics            ← calculado uma vez
  ├── iterations
  ├── capacity
  └── tasks
      ↓
/api/metrics/[teamId]
      ↓
Dashboard React (Next.js)
```

---

## 🛠 Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | Tailwind CSS |
| Gráficos | Recharts |
| Banco | SQLite via `better-sqlite3` |
| API Client | `fetch` puro (sem SDK Azure) |
| Validação | Zod |
| Datas | date-fns |
| Runtime | Node.js 20 |

---

## ❓ Problemas Comuns

**`.env.example` não encontrado**  
Certifique-se de estar na pasta raiz do projeto:
```bash
ls .env.example   # deve aparecer
cp .env.example .env.local
```

**Erro `Cannot find module 'better-sqlite3'`**  
```bash
npm install
```

**Banco não inicializado**  
```bash
npx ts-node --project tsconfig.json scripts/initDb.ts
```

**Porta 3000 ocupada**  
```bash
npm run dev -- -p 3001
```
