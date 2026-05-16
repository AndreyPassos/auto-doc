# Padrões Reconhecidos pelo Processamento OCR

O módulo de OCR (`internal/ocr/processor.go`) extrai texto de documentos PDF e PNG e aplica expressões regulares para identificar padrões estruturados. Os resultados são armazenados na coluna `patterns` (JSONB) do registro do documento.

---

## Padrões reconhecidos

### CPF

**Campo JSON:** `cpf`

**Formato:** `NNN.NNN.NNN-NN`

**Expressão regular:** `\d{3}\.\d{3}\.\d{3}-\d{2}`

**Exemplo encontrado:** `123.456.789-09`

---

### CNPJ

**Campo JSON:** `cnpj`

**Formato:** `NN.NNN.NNN/NNNN-NN`

**Expressão regular:** `\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}`

**Exemplo encontrado:** `12.345.678/0001-90`

---

### Datas

**Campo JSON:** `dates`

**Formato:** `DD/MM/YYYY`

**Expressão regular:** `\d{2}/\d{2}/\d{4}`

**Exemplo encontrado:** `31/12/2024`

---

### Valores monetários

**Campo JSON:** `amounts`

**Formato:** `R$ N.NNN,NN` (com ou sem espaço após `R$`, aceita separadores variados)

**Expressão regular:** `R\$\s*[\d.,]+`

**Exemplos encontrados:** `R$ 1.500,00`, `R$250.00`

---

## Comportamento

- Todos os padrões retornam listas de strings únicas (duplicatas removidas).
- A extração é feita sobre o texto normalizado após o OCR, com linhas em branco removidas e espaços extras compactados.
- O processamento não valida os valores encontrados (ex: não verifica dígito verificador de CPF/CNPJ) — apenas localiza strings que correspondem ao formato.
- Documentos com OCR bem-sucedido mas sem nenhum padrão identificado retornam listas vazias em todos os campos.

---

## Exemplo de resposta

```json
{
  "cpf": ["123.456.789-09"],
  "cnpj": ["12.345.678/0001-90"],
  "dates": ["01/01/2024", "31/12/2024"],
  "amounts": ["R$ 15.000,00", "R$ 250,00"]
}
```

---

## Ferramentas de extração de texto

| Tipo de arquivo | Ferramenta | Flags |
|---|---|---|
| PDF | `pdftotext` (poppler-utils) | `-layout` — preserva layout de colunas |
| PNG / imagem | `tesseract` | `-l por --psm 3` — idioma português, detecção automática de orientação |
