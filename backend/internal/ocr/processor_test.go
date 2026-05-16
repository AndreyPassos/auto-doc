package ocr

import (
	"testing"
)

// assertSliceEqual checks that two string slices have the same length and elements.
func assertSliceEqual(t *testing.T, label string, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: got %d elements %v, want %d elements %v", label, len(got), got, len(want), want)
		return
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%s[%d]: got %q, want %q", label, i, got[i], want[i])
		}
	}
}

// assertEmptySlice verifies the slice is non-nil and has zero elements.
func assertEmptySlice(t *testing.T, label string, got []string) {
	t.Helper()
	if got == nil {
		t.Errorf("%s: expected empty (non-nil) slice, got nil", label)
		return
	}
	if len(got) != 0 {
		t.Errorf("%s: expected empty slice, got %v", label, got)
	}
}

func TestExtractPatterns_CPF(t *testing.T) {
	text := "CPF do contribuinte: 123.456.789-09"
	p := ExtractPatterns(text)

	assertSliceEqual(t, "CPFs", p.CPFs, []string{"123.456.789-09"})
	assertEmptySlice(t, "CNPJs", p.CNPJs)
	assertEmptySlice(t, "Dates", p.Dates)
	assertEmptySlice(t, "Amounts", p.Amounts)
}

func TestExtractPatterns_CNPJ(t *testing.T) {
	text := "CNPJ da empresa: 12.345.678/0001-90"
	p := ExtractPatterns(text)

	assertEmptySlice(t, "CPFs", p.CPFs)
	assertSliceEqual(t, "CNPJs", p.CNPJs, []string{"12.345.678/0001-90"})
	assertEmptySlice(t, "Dates", p.Dates)
	assertEmptySlice(t, "Amounts", p.Amounts)
}

func TestExtractPatterns_Dates(t *testing.T) {
	text := "Data de emissão: 15/03/2024"
	p := ExtractPatterns(text)

	assertEmptySlice(t, "CPFs", p.CPFs)
	assertEmptySlice(t, "CNPJs", p.CNPJs)
	assertSliceEqual(t, "Dates", p.Dates, []string{"15/03/2024"})
	assertEmptySlice(t, "Amounts", p.Amounts)
}

func TestExtractPatterns_Amounts(t *testing.T) {
	text := "Valor total: R$ 1.250,00"
	p := ExtractPatterns(text)

	assertEmptySlice(t, "CPFs", p.CPFs)
	assertEmptySlice(t, "CNPJs", p.CNPJs)
	assertEmptySlice(t, "Dates", p.Dates)
	assertSliceEqual(t, "Amounts", p.Amounts, []string{"R$ 1.250,00"})
}

func TestExtractPatterns_MultipleMatches(t *testing.T) {
	text := "CPF: 111.111.111-11 e 222.222.222-22 Data: 01/01/2024 e 31/12/2023 Valor: R$100,00 e R$ 200,00 CNPJ: 11.111.111/0001-11"
	p := ExtractPatterns(text)

	assertSliceEqual(t, "CPFs", p.CPFs, []string{"111.111.111-11", "222.222.222-22"})
	assertSliceEqual(t, "CNPJs", p.CNPJs, []string{"11.111.111/0001-11"})
	assertSliceEqual(t, "Dates", p.Dates, []string{"01/01/2024", "31/12/2023"})
	assertSliceEqual(t, "Amounts", p.Amounts, []string{"R$100,00", "R$ 200,00"})
}

func TestExtractPatterns_Deduplication(t *testing.T) {
	text := "CPF: 000.000.000-00 e depois novamente CPF: 000.000.000-00"
	p := ExtractPatterns(text)

	assertSliceEqual(t, "CPFs", p.CPFs, []string{"000.000.000-00"})
	assertEmptySlice(t, "CNPJs", p.CNPJs)
	assertEmptySlice(t, "Dates", p.Dates)
	assertEmptySlice(t, "Amounts", p.Amounts)
}

func TestExtractPatterns_EmptyText(t *testing.T) {
	p := ExtractPatterns("")

	assertEmptySlice(t, "CPFs", p.CPFs)
	assertEmptySlice(t, "CNPJs", p.CNPJs)
	assertEmptySlice(t, "Dates", p.Dates)
	assertEmptySlice(t, "Amounts", p.Amounts)
}

func TestExtractPatterns_NoMatches(t *testing.T) {
	text := "Este texto não contém nenhum padrão reconhecível pelo extrator."
	p := ExtractPatterns(text)

	assertEmptySlice(t, "CPFs", p.CPFs)
	assertEmptySlice(t, "CNPJs", p.CNPJs)
	assertEmptySlice(t, "Dates", p.Dates)
	assertEmptySlice(t, "Amounts", p.Amounts)
}
