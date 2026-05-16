# ADR 001 — Banco de dados único (PostgreSQL)

**Status:** Aceito  
**Data:** 2024-01

---

## Contexto

O diagrama v1.3 DRAFT propunha três bancos de dados distintos:

- **MongoDB** para metadados de documentos (schema flexível)
- **PostgreSQL** para usuários e autenticação
- **MySQL** para dados de relatórios

Essa topologia exige que joins entre entidades de domínios diferentes sejam feitos no código da aplicação, o que é um anti-pattern: aumenta a complexidade, impossibilita transações ACID entre domínios e multiplica a carga operacional (3 serviços para operar, monitorar e fazer backup).

---

## Decisão

Usar **PostgreSQL como banco de dados único** para todas as entidades do sistema: usuários, documentos, logs de auditoria e metadados.

---

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|---|---|
| Manter 3 bancos | Anti-pattern de joins na aplicação; complexidade operacional desnecessária |
| Somente MongoDB | Não oferece transações ACID completas; sem suporte nativo a SQL para relatórios |
| SQLite em desenvolvimento | Divergência entre dev e produção; sem suporte a múltiplas conexões simultâneas |

---

## Consequências

**Positivas:**
- Operação simplificada: um único serviço para monitorar, fazer backup e escalar.
- Joins feitos pelo banco de dados, com garantias transacionais ACID.
- `JSONB` lida com os metadados flexíveis dos documentos sem a necessidade de MongoDB.
- `tsvector`/`tsquery` provê full-text search sem Elasticsearch.
- Migrations versionadas com `golang-migrate` garantem evolução controlada do schema.

**Negativas / trade-offs:**
- Schema de metadados precisa ser pensado com mais cuidado do que em um banco document-oriented.
- Se diferentes domínios precisarem de escalabilidade independente no futuro, será necessário revisitar esta decisão.
