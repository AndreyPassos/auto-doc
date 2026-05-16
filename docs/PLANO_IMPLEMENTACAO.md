# Plano de Implementação — AutoDoc

> Documento de controle contínuo da implementação. Atualizar conforme progresso.
> Gerado a partir da análise do `diagrama_arquitetura.pdf` v1.3 DRAFT e do `Desafio_Tecnico_Candidatos.docx`.

---

## Gaps Corrigidos no Diagrama Original

| # | Problema original | Decisão tomada |
|---|-------------------|----------------|
| 1 | 3 bancos diferentes (MongoDB + PostgreSQL + MySQL) | PostgreSQL único com JSONB |
| 2 | MySQL para XML com "join via aplicação" | JSONB no PostgreSQL, sem join externo |
| 3 | Elasticsearch obrigatório | `tsvector` do PostgreSQL suficiente para 5k docs/dia |
| 4 | Filesystem sem backup e sem expiração | Volume Docker com política de retenção de 90 dias |
| 5 | Kubernetes + Docker Compose no mesmo diagrama | Docker Compose único para este escopo |
| 6 | Processamento síncrono | Worker pool de goroutines + polling no frontend |
| 7 | RabbitMQ "opcional" | Removido — goroutines resolvem sem infra extra |
| 8 | Redis "TTL a definir" | Removido da v1 — JWT stateless dispensa cache de sessão |
| 9 | Notificações sem trigger definido | Removido — sem requisito claro |
| 10 | Mobile App | Fora de escopo — SPA web apenas |
| 11 | CDN Cloudflare | Fora de escopo — NGINX serve os estáticos |
| 12 | ELK Stack para logs | Zerolog (JSON estruturado no stdout) |
| 13 | XSD opcional | Validação XML obrigatória via schema interno |
| 14 | Auth Service sem store de tokens | Mantido — JWT stateless correto para esta escala |
| 15 | Schema XML indefinido | Definido: `<documento><referencia><cliente><classificacao><periodo><metadados>` |

---

## Módulo 1 — Arquitetura e Documentação

- [x] Repositório GitHub público: `AndreyPassos/auto-doc`
- [x] Diagrama revisado em Mermaid — `docs/architecture.md`
- [x] 5 ADRs escritos — `docs/adrs/001` a `005`
- [x] Schema XML documentado — `docs/xml-schema.md` + `exemplo.xml`

---

## Módulo 2 — Core Backend (Go)

- [x] Setup Go 1.22 com Gin, sqlx, zerolog, golang-migrate — `backend/go.mod`
- [x] Docker Compose (Go + PostgreSQL) — `docker-compose.yml`
- [x] Migrations do schema — `backend/migrations/000001_initial.up.sql`
- [x] Auth: `POST /login` com JWT + middleware por role — `internal/auth/`
- [x] Upload: `POST /documents` com validação de magic bytes — `internal/document/service.go`
- [x] Worker pool assíncrono (goroutines + canal buffered) — `internal/worker/pool.go`
- [x] PDF parser via `pdftotext` — `internal/ocr/processor.go`
- [x] OCR de PNG via `tesseract -l por` — `internal/ocr/processor.go`
- [x] Extração de padrões: CPF, CNPJ, datas, valores BRL — `internal/ocr/processor.go`
- [x] `GET /documents/:id` com polling de status — `internal/document/handler.go`
- [x] `POST /documents/:id/enrich` com validação XML — `internal/xmlparser/parser.go`
- [x] `DELETE /documents/:id` (admin only, hard delete + remoção do arquivo) — `internal/document/handler.go`
- [x] Logs estruturados em todos os handlers (zerolog)
- [x] Tratamento de erros: OCR falhou, XML malformado, ID inexistente
- [x] Graceful shutdown: pool drena antes do HTTP server fechar

---

## Módulo 3 — Relatórios, Containerização e Testes

- [x] `GET /reports/summary` (total, by_status, by_type, by_day) — `internal/report/service.go`
- [x] `GET /documents` com filtros (status, período, xml_enriched, paginação) — `internal/document/repository.go`
- [x] `GET /reports/export?format=csv` — `internal/report/service.go`
- [x] Dockerfile multi-stage para Go (non-root, poppler + tesseract) — `backend/Dockerfile`
- [x] Dockerfile para frontend (nginx serving build) — `frontend/Dockerfile`
- [x] `docker-compose.yml` com PostgreSQL, backend, frontend, nginx
- [x] Volumes e `.env.example`
- [x] `README.md` completo
- [x] `CHALLENGES.md`
- [x] Coleção REST Client — `api.http`
- [x] Testes unitários: extração de padrões — `internal/ocr/processor_test.go`
- [x] Teste de integração: upload + leitura — `internal/document/integration_test.go`

---

## Módulo 4 — Frontend (React + Vite + TypeScript)

- [x] Setup Vite + React 18 + TypeScript + Tailwind CSS
- [x] Roteamento com React Router v6 + rotas protegidas por role
- [x] Auth: login com JWT, store Zustand, interceptor Axios (401 → redirect)
- [x] Chave `localStorage` corrigida: `auth_token` consistente em store e client
- [x] `BrowserRouter` duplicado removido (`main.tsx`)
- [x] Páginas duplicadas removidas (re-exports consolidados via import direto)
- [x] **Layout**: sidebar com ícones, avatar do usuário com iniciais, badge de role colorido
- [x] **DocumentList**: linhas clicáveis, badge XML, botão de delete (admin), filtros com RFC3339
- [x] **DocumentUpload**: estado de sucesso com ação direta, preview do arquivo selecionado
- [x] **DocumentDetail**: padrões coloridos por categoria, feedback de erro no enrich, breadcrumb
- [x] **ReportsDashboard**: cards com ícones, barra de progresso por status, tabela clicável
- [x] **UserManagement**: modal para criação, badges de role coloridos, e-mail na tabela
- [x] `DELETE /documents/:id` integrado no frontend (admin only, com confirmação)
- [x] Formato de datas corrigido: date inputs → RFC3339 (`T00:00:00Z` / `T23:59:59Z`)
- [x] `start.sh`: script de desenvolvimento local com carregamento de `.env.local`

---

## Pendências / Backlog

| Item | Prioridade | Notas |
|------|------------|-------|
| Testes e2e do fluxo completo (upload → OCR → enrich → relatório) | Média | Manual por ora |
| Retenção automática de arquivos (90 dias) | Baixa | Cron job ou pg_cron |
| `POST /api/v1/auth/logout` | Baixa | JWT stateless — logout é client-side |
| Refresh token | Baixa | Login novo ao expirar (24h) |
| Soft delete em vez de hard delete para documentos | Baixa | Requer migration + filtro em todas as queries |
| Paginação no relatório de exportação CSV | Baixa | Atualmente exporta todos os registros do período |

---

## Critérios de Aceitação

```bash
# Subir o ambiente completo
docker compose up -d

# Verificar saúde
curl http://localhost:8080/api/v1/health   # → {"status":"ok"}
open http://localhost:3000                 # SPA carrega

# Fluxo completo
POST /api/v1/auth/login
POST /api/v1/documents          # upload PDF ou PNG
GET  /api/v1/documents/:id      # polling até status=completed
POST /api/v1/documents/:id/enrich  # XML
GET  /api/v1/reports/summary
GET  /api/v1/reports/export?format=csv

# Desenvolvimento local
./start.sh   # requer .env.local configurado
```
