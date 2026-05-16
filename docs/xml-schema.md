# Schema XML — Enriquecimento de Documentos

Este documento descreve o schema XML aceito pelo endpoint de enriquecimento e as regras de validação aplicadas pelo backend.

---

## Endpoint

```
POST /api/v1/documents/:id/enrich
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Campo do formulário:** `xml` — arquivo XML conforme o schema abaixo.

O endpoint retorna `HTTP 200` com os metadados enriquecidos em caso de sucesso, ou `HTTP 422` com a descrição do erro de validação.

---

## Exemplo completo

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

---

## Descrição dos campos

### `<documento>` (raiz, obrigatório)

Elemento raiz do documento XML.

---

### `<referencia>` (obrigatório)

Identificador único do documento no sistema do integrador. String livre, não vazia.

```xml
<referencia>DOC-2024-001</referencia>
```

---

### `<cliente>` (obrigatório)

Dados do cliente associado ao documento.

| Elemento | Obrigatório | Descrição |
|---|---|---|
| `<nome>` | Sim | Nome completo ou razão social do cliente |
| `<codigo>` | Não | Código interno do cliente no sistema origem |
| `<cnpj>` | Não | CNPJ no formato `XX.XXX.XXX/XXXX-XX` |

```xml
<cliente>
  <codigo>12345</codigo>
  <nome>Empresa ABC Ltda</nome>
  <cnpj>12.345.678/0001-90</cnpj>
</cliente>
```

---

### `<classificacao>` (opcional)

Categoria do documento. Valores aceitos:

| Valor | Descrição |
|---|---|
| `fiscal` | Documentos fiscais (NF-e, NFS-e, etc.) |
| `contabil` | Documentos contábeis (balanços, balancetes, etc.) |
| `juridico` | Documentos jurídicos (contratos, procurações, etc.) |
| `outro` | Qualquer outra categoria |

Se omitido ou se o valor não pertencer ao enum, a validação retorna erro.

```xml
<classificacao>fiscal</classificacao>
```

---

### `<periodo>` (opcional)

Período de competência ou vigência do documento.

| Elemento | Obrigatório dentro de `<periodo>` | Formato |
|---|---|---|
| `<inicio>` | Sim | `YYYY-MM-DD` |
| `<fim>` | Sim | `YYYY-MM-DD` |

Se `<periodo>` estiver presente, ambos os sub-elementos são obrigatórios. A data de início deve ser anterior ou igual à data de fim.

```xml
<periodo>
  <inicio>2024-01-01</inicio>
  <fim>2024-12-31</fim>
</periodo>
```

---

### `<metadados>` (opcional)

Pares chave-valor livres para extensibilidade. Cada par é representado por um elemento `<campo>` com o atributo `chave`.

- O atributo `chave` é obrigatório e deve ser único dentro de `<metadados>`.
- O conteúdo textual do elemento é o valor associado à chave.

```xml
<metadados>
  <campo chave="numero_nota">NF-1234</campo>
  <campo chave="valor_total">15000.00</campo>
  <campo chave="centro_custo">CC-007</campo>
</metadados>
```

---

## Regras de validação

A validação é **programática** (não XSD). As regras aplicadas são:

1. O XML deve ser bem-formado (parse sem erro).
2. O elemento raiz deve ser `<documento>`.
3. `<referencia>` deve estar presente e não vazia.
4. `<cliente>` deve estar presente; `<cliente><nome>` deve estar presente e não vazio.
5. Se `<classificacao>` estiver presente, o valor deve ser um dos quatro valores do enum.
6. Se `<periodo>` estiver presente, `<inicio>` e `<fim>` devem estar presentes, no formato `YYYY-MM-DD`, e `inicio <= fim`.
7. Em `<metadados>`, o atributo `chave` não pode ser vazio.

Erros de validação retornam `HTTP 422 Unprocessable Entity` com o campo `error` descrevendo a violação.

---

## Como funciona o enriquecimento

1. O cliente envia uma requisição `multipart/form-data` com o campo `xml` contendo o arquivo XML.
2. O backend lê e parseia o XML.
3. As regras de validação são aplicadas; qualquer falha interrompe o processo com `422`.
4. Os metadados extraídos (referencia, cliente, classificacao, periodo, campos livres) são serializados como JSON e armazenados na coluna `xml_metadata` do registro do documento.
5. O campo `enriched_at` é atualizado com o timestamp atual.
6. A resposta inclui o documento atualizado com todos os metadados.
