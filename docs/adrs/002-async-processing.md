# ADR 002 — Processamento OCR assíncrono com polling

**Status:** Aceito  
**Data:** 2024-01

---

## Contexto

O processamento de OCR envolve a execução de ferramentas externas (`pdftotext`, `tesseract`) sobre arquivos enviados pelo usuário. Dependendo do tamanho e da qualidade do documento, esse processo pode levar de **10 a 30 segundos**.

O diagrama original invocava o OCR de forma síncrona dentro do ciclo de vida da requisição HTTP: o cliente enviava o arquivo e aguardava a resposta com o texto extraído. Essa abordagem causa:

- Timeouts no cliente (browsers, proxies) para documentos mais pesados.
- Conexões HTTP presas durante toda a duração do processamento.
- Impossibilidade de reportar progresso intermediário.

---

## Decisão

Processar o OCR de forma **assíncrona**:

1. O endpoint `POST /api/v1/documents` aceita o upload, salva o arquivo e cria o registro no banco com `status = pending`. Retorna imediatamente com `HTTP 202 Accepted`.
2. Um worker do pool recebe o job e executa o OCR em background.
3. Ao concluir, o worker atualiza o registro com `status = done` (ou `error`) e o texto extraído.
4. O frontend faz **polling** do endpoint `GET /api/v1/documents/:id` para verificar o status.

---

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|---|---|
| Processamento síncrono | Timeouts em documentos grandes; experiência ruim para o usuário |
| WebSocket / SSE para push de status | Aumenta a complexidade do servidor e do cliente; polling é suficiente para este SLA |
| RabbitMQ como fila de jobs | Infraestrutura adicional desnecessária para o volume atual (ver ADR 004) |

---

## Consequências

**Positivas:**
- Upload retorna imediatamente — UX muito melhor.
- Sem risco de timeout HTTP para documentos grandes.
- Fácil de rastrear o estado do processamento via campo `status` no banco.

**Negativas / trade-offs:**
- O frontend precisa implementar polling (intervalo recomendado: 3–5 segundos).
- Há uma janela de latência entre o término do OCR e a percepção do usuário.
- Se o servidor reiniciar com jobs `pending` no banco e sem reencaminhamento, esses documentos ficam presos em estado intermediário — mitigação futura: job de recovery na inicialização.
