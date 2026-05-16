# ADR 004 — Worker pool com goroutines em vez de RabbitMQ

**Status:** Aceito  
**Data:** 2024-01

---

## Contexto

O diagrama v1.3 DRAFT listava o RabbitMQ como **"optional / evaluate necessity"** para gerenciar a fila de jobs de OCR. A decisão foi avaliar se o volume projetado justifica um message broker externo.

Volume projetado: **5.000 documentos/dia ≈ 0,058 documentos/segundo** (ou ~3,5 docs/minuto em pico estimado de 2×).

---

## Decisão

Usar um **pool de goroutines com canal Go bufferizado** (`chan Job`) para enfileirar e processar jobs de OCR, sem nenhum message broker externo.

A implementação consiste em:

- Um canal `jobs chan Job` com buffer configurável.
- `N` goroutines workers (padrão: `WORKER_POOL_SIZE=4`) que consomem do canal.
- Shutdown gracioso: `pool.Shutdown(ctx)` drena os jobs em andamento antes de encerrar.

---

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|---|---|
| RabbitMQ | Serviço adicional a operar; não justificado pelo volume atual |
| Apache Kafka | Projetado para volumes de eventos muito maiores; over-engineering |
| Redis Streams | Dependência adicional; complexidade de ACK/requeue desnecessária |

---

## Consequências

**Positivas:**
- **Zero infraestrutura adicional** — sem novo serviço no `docker-compose.yml`.
- Simplicidade: o pool é inicializado em ~10 linhas de Go e é naturalmente testável.
- Latência de enfileiramento em nanosegundos (canal em memória).
- Shutdown gracioso garante que jobs em andamento são concluídos antes de o processo encerrar.

**Negativas / trade-offs:**
- **Sem persistência de fila**: se o processo morrer com jobs enfileirados, eles se perdem. Jobs `pending` no banco precisarão de um mecanismo de recovery futuro.
- **Sem escalabilidade horizontal nativa**: múltiplas réplicas do backend processariam jobs independentemente sem coordenação. Ao escalar horizontalmente, esta decisão precisará ser revisitada (RabbitMQ ou Redis Streams seriam as próximas opções naturais).
- Backpressure limitada ao tamanho do buffer do canal — sobrecarga extrema pode bloquear uploads.
