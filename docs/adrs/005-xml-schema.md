# ADR 005 — Schema XML para enriquecimento de documentos

**Status:** Aceito  
**Data:** 2024-01

---

## Contexto

O diagrama v1.3 DRAFT mencionava "enriquecimento via XML" como etapa do pipeline, mas **não definia nenhum schema**. Sem um contrato estruturado, qualquer sistema que envie XMLs de enriquecimento precisaria inspecionar o código-fonte para descobrir os campos esperados — o que é inviável em integrações entre sistemas.

O desafio requer que o candidato defina e documente o schema.

---

## Decisão

Definir um **schema XML estruturado** para o endpoint de enriquecimento de documentos, com validação programática no backend (não XSD).

O schema abaixo é o contrato oficial do endpoint `POST /api/v1/documents/:id/enrich`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<documento>
  <referencia>DOC-2024-001</referencia>
  <cliente>
    <codigo>12345</codigo>
    <nome>Empresa ABC Ltda</nome>
    <cnpj>12.345.678/0001-90</cnpj>
  </cliente>
  <classificacao>fiscal</classificacao>
  <periodo>
    <inicio>2024-01-01</inicio>
    <fim>2024-12-31</fim>
  </periodo>
  <metadados>
    <campo chave="numero_nota">NF-1234</campo>
    <campo chave="valor_total">15000.00</campo>
  </metadados>
</documento>
```

**Campos obrigatórios:** `referencia`, `cliente` (com `nome` obrigatório).  
**Campos opcionais:** `cliente.codigo`, `cliente.cnpj`, `classificacao`, `periodo`, `metadados`.  
**Enum `classificacao`:** `fiscal` | `contabil` | `juridico` | `outro`.

---

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|---|---|
| XML livre (key-value sem estrutura) | Sem contrato definido; dificulta integrações e validação |
| JSON no lugar de XML | O desafio especifica XML; manter o requisito original |
| XSD para validação | Adiciona dependência de parser XSD; validação programática é suficiente e mais flexível |

---

## Consequências

**Positivas:**
- Contrato claro entre sistemas integradores e o backend.
- Validação no momento do enriquecimento garante consistência dos metadados.
- O elemento `<metadados>` com `<campo chave="...">` permite extensibilidade sem alterar o schema raiz.
- Documentado em `docs/xml-schema.md` para referência dos integradores.

**Negativas / trade-offs:**
- Validação programática não é tão rigorosa quanto XSD (sem restrições de tipo, cardinalidade exata, etc.).
- Mudanças no schema requerem atualização da documentação e comunicação aos integradores — sem versionamento formal de schema por enquanto.
