# auto-doc — Sistema de Processamento Documental

Sistema para upload, extração de texto (OCR), enriquecimento via XML e geração de relatórios de documentos. Desenvolvido como desafio técnico para a Keltech.

---

## Arquitetura

Quatro camadas simplificadas em relação ao rascunho original (ver [`docs/architecture.md`](docs/architecture.md)):

```
Browser (React + Vite)
    ↓ HTTPS / REST
NGINX (reverse proxy)
    ├── /api/*  →  Go API (Gin + sqlx)
    │               ├── Worker Pool (goroutines) → OCR (pdftotext / tesseract)
    │               ├── PostgreSQL (users · documents · audit_logs)
    │               └── File System (Docker Volume /var/uploads)
    └── /*      →  Frontend (nginx static)
```

**O que foi removido do diagrama original e por quê:** MongoDB, MySQL, Elasticsearch (cluster 3 nós) e RabbitMQ foram eliminados. PostgreSQL único + worker pool em goroutines é suficiente para a escala proposta. Veja os [ADRs](docs/adrs/) para a justificativa completa.

---

## Quick Start

```bash
cp .env.example .env
# Edite .env com senhas seguras antes de usar em produção
docker compose up -d
```

A aplicação ficará disponível em `http://localhost`.

Um usuário admin é criado automaticamente na primeira inicialização com as credenciais definidas em `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`.

---

## Endpoints

### Autenticação

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Não | Autentica e retorna JWT |
| `GET` | `/api/v1/auth/me` | JWT | Retorna o usuário autenticado |

### Documentos

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/v1/documents` | JWT | Faz upload de um documento (PDF ou imagem) |
| `GET` | `/api/v1/documents` | JWT | Lista documentos com paginação e filtros |
| `GET` | `/api/v1/documents/:id` | JWT | Retorna detalhes e status de OCR de um documento |
| `POST` | `/api/v1/documents/:id/enrich` | JWT | Enriquece um documento com metadados via XML |

### Relatórios

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/reports/summary` | JWT | Resumo agregado (total, por status, por classificação) |
| `GET` | `/api/v1/reports/documents` | JWT | Lista detalhada de documentos para relatório |
| `GET` | `/api/v1/reports/export` | JWT | Exporta relatório em CSV |

### Usuários (somente admin)

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/users` | JWT + admin | Lista todos os usuários |
| `POST` | `/api/v1/users` | JWT + admin | Cria novo usuário |
| `PUT` | `/api/v1/users/:id` | JWT + admin | Atualiza usuário |
| `DELETE` | `/api/v1/users/:id` | JWT + admin | Remove usuário |

### Health

| Método | Path | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/health` | Não | Verifica se o servidor está no ar |

---

## Tecnologias

| Tecnologia | Papel | Justificativa |
|---|---|---|
| **Go 1.22** | Backend | Performance, concorrência nativa (goroutines para worker pool), binário único sem runtime externo |
| **Gin** | HTTP framework | Roteamento rápido, middleware simples, amplamente adotado no ecossistema Go |
| **sqlx** | Acesso ao banco | Extensão leve do `database/sql`; evita ORMs pesados mantendo o SQL explícito |
| **golang-migrate** | Migrations | Migrations versionadas em SQL puro, sem DSL adicional |
| **PostgreSQL 16** | Banco de dados | ACID, JSONB para metadados flexíveis, `tsvector` para FTS — substitui MongoDB + MySQL + Elasticsearch do diagrama original |
| **pdftotext / tesseract** | OCR | Ferramentas maduras e open-source; integração via `exec` mantém o backend stateless em relação ao OCR |
| **React 18 + Vite** | Frontend | SPA com build rápido; Vite elimina lentidão do Webpack em desenvolvimento |
| **TypeScript** | Tipagem | Reduz erros de integração entre frontend e API |
| **Tailwind CSS** | Estilos | Utilitários inline eliminam arquivos CSS separados; consistência de design |
| **NGINX** | Reverse proxy | Roteamento `/api/*` → backend, `/*` → frontend static; TLS termination point |
| **Docker Compose** | Orquestração local | Sobe toda a stack com um único comando |

---

## Desenvolvimento local

### Backend

```bash
cd backend
go run ./cmd/server
```

Variáveis de ambiente necessárias: `DATABASE_URL`, `JWT_SECRET`. As demais têm valores padrão adequados para desenvolvimento.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend em modo dev usa proxy para `http://localhost:8080` (configurado no `vite.config.ts`).

---

## Documentação adicional

- [`docs/architecture.md`](docs/architecture.md) — Diagrama da arquitetura e diferenças em relação ao rascunho original
- [`docs/adrs/001-single-database.md`](docs/adrs/001-single-database.md) — PostgreSQL único em vez de 3 bancos
- [`docs/adrs/002-async-processing.md`](docs/adrs/002-async-processing.md) — OCR assíncrono com polling
- [`docs/adrs/003-no-elasticsearch.md`](docs/adrs/003-no-elasticsearch.md) — Remoção do Elasticsearch
- [`docs/adrs/004-no-message-broker.md`](docs/adrs/004-no-message-broker.md) — Worker pool em vez de RabbitMQ
- [`docs/adrs/005-xml-schema.md`](docs/adrs/005-xml-schema.md) — Schema XML para enriquecimento
- [`docs/xml-schema.md`](docs/xml-schema.md) — Referência completa do schema XML
- [`CHALLENGES.md`](CHALLENGES.md) — Dificuldades, decisões alternativas e débitos técnicos
