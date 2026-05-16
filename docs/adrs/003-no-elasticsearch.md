# ADR 003 — Remoção do Elasticsearch

**Status:** Aceito  
**Data:** 2024-01

---

## Contexto

O diagrama v1.3 DRAFT marcava o Elasticsearch como **"mandatory"** e especificava um cluster de 3 nós para full-text search sobre os documentos processados. O volume projetado é de aproximadamente **5.000 documentos/dia**.

Um cluster Elasticsearch de 3 nós implica:

- Três instâncias de JVM consumindo memória significativa (mínimo ~2 GB por nó).
- Sincronização de índice entre nós (replication shards).
- Operação, monitoramento e upgrade independentes do restante da stack.
- Custo de infraestrutura consideravelmente maior.

---

## Decisão

**Remover o Elasticsearch** da arquitetura e utilizar o **`tsvector` / `tsquery` do PostgreSQL** para full-text search.

---

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|---|---|
| Manter Elasticsearch (3 nós) | Custo e complexidade operacional desproporcional ao volume |
| Typesense | Serviço adicional; não justificado para o volume atual |
| Meilisearch | Serviço adicional; não justificado para o volume atual |

---

## Consequências

**Positivas:**
- Zero infraestrutura adicional — a busca fica no mesmo PostgreSQL já em operação.
- Índice `GIN` com `tsvector` tem desempenho adequado para milhões de documentos.
- Sem custo de sincronização entre banco e índice de busca (dados são a mesma fonte).
- Redução significativa de complexidade no `docker-compose.yml` e nos requisitos de hardware.

**Negativas / trade-offs:**
- Funcionalidades avançadas de relevância (BM25 ajustado, facets, highlight por token) são mais limitadas no PostgreSQL do que no Elasticsearch.
- Se o volume crescer para dezenas de milhões de documentos com alta carga de busca concorrente, esta decisão precisará ser revisitada.
