# Desafios, Decisões e Débitos Técnicos

## 1. Dificuldades encontradas

### Abordagem `exec` para OCR

A integração com `pdftotext` e `tesseract` é feita via `os/exec`, o que significa que o backend depende dessas ferramentas instaladas na imagem Docker. Isso introduz acoplamento ao ambiente de execução e torna os testes unitários do módulo de OCR mais difíceis (exigem mocks de `exec.Command` ou uma imagem de teste com as ferramentas instaladas).

A abordagem foi mantida porque é pragmática e corresponde ao que o desafio descreve, mas em produção real valeria avaliar bibliotecas Go nativas ou serviços de OCR gerenciados.

### Ciclo de importação entre `worker` e `document`

O package `worker` precisa chamar o repositório de documentos para atualizar o status dos jobs, e o package `document` precisa submeter jobs ao worker pool. A dependência circular foi resolvida com a interface `JobSubmitter`:

```go
// No package worker
type JobSubmitter interface {
    Submit(job Job) error
}
```

O `document.Service` recebe um `worker.JobSubmitter` por injeção de dependência, sem importar o package `worker` diretamente. Isso quebra o ciclo e mantém os packages testáveis de forma independente.

### Design do processamento assíncrono

Decidir o contrato entre o upload e o processamento levou algumas iterações: o endpoint retorna `202 Accepted` imediatamente, mas o cliente precisa saber quando o documento está pronto. O polling via `GET /api/v1/documents/:id` foi escolhido pela simplicidade, mas requer que o frontend gerencie o ciclo de polling sem criar requisições desnecessárias.

---

## 2. Decisões que seriam diferentes com mais tempo

| Área | O que mudaria |
|---|---|
| **Validação XML** | Implementar validação via XSD com um parser adequado, em vez de validação programática manual. Seria mais rigorosa e auto-documentável. |
| **Upload em lote** | Adicionar endpoint `POST /api/v1/documents/batch` para aceitar múltiplos arquivos em uma requisição, com retorno de status por arquivo. |
| **Cache de relatórios** | Introduzir Redis para cachear os resultados de `GET /api/v1/reports/summary` e `GET /api/v1/reports/export`, que podem ser consultas pesadas em volumes grandes. |
| **Refresh tokens** | O sistema atual emite JWTs de vida fixa (24h por padrão). Com mais tempo, implementaria refresh tokens com rotação para melhorar a segurança sem forçar o usuário a relogar. |
| **Testes de integração** | Adicionar uma suite de testes de integração com `testcontainers-go` que sobe um PostgreSQL real e testa os handlers de ponta a ponta. |
| **Testes E2E** | Adicionar testes E2E com Playwright ou Cypress cobrindo os fluxos principais do frontend (login, upload, visualização, enriquecimento). |
| **Recovery de jobs pendentes** | Na inicialização, varrer documentos com `status = pending` que ficaram presos e reenfileirá-los no worker pool. |

---

## 3. Débitos técnicos assumidos

| Débito | Localização | Impacto |
|---|---|---|
| Sem paginação na listagem de usuários | `GET /api/v1/users` | Em sistemas com muitos usuários, a resposta pode ficar grande. A listagem de documentos tem paginação; usuários ficaram sem por ser uma rota admin de uso menos frequente. |
| Validação de e-mail simplificada | `user/handler.go` | A validação verifica apenas se o campo não está vazio, sem checar o formato do e-mail. Uma biblioteca como `net/mail` resolveria isso trivialmente. |
| `parseIntParam` duplicado | `document/handler.go` e `report/handler.go` | A função auxiliar que converte query params de string para int foi copiada entre dois handlers. Deveria estar em um package `pkg/httputil`. |
| Docker Compose single-host | `docker-compose.yml` | O `docker-compose.yml` é adequado para desenvolvimento e demonstração, mas não é production-grade. Um ambiente de produção real exigiria Kubernetes (ou similar) com auto-scaling, health checks externos, secrets management e storage distribuído. |
| Sem rate limiting | Todos os endpoints | Não há proteção contra abuso de API (brute force em login, upload massivo). Em produção, NGINX ou um middleware de rate limiting como `tollbooth` seriam necessários. |
