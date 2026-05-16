package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

var (
	reCPF    = regexp.MustCompile(`\d{3}\.\d{3}\.\d{3}-\d{2}`)
	reCNPJ   = regexp.MustCompile(`\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}`)
	reDate   = regexp.MustCompile(`\d{2}/\d{2}/\d{4}`)
	reAmount = regexp.MustCompile(`R\$\s*[\d.,]+`)
)

type Patterns struct {
	CPFs    []string `json:"cpf"`
	CNPJs   []string `json:"cnpj"`
	Dates   []string `json:"dates"`
	Amounts []string `json:"amounts"`
}

func ProcessPDF(filePath string) (string, error) {
	out, err := exec.Command("pdftotext", "-layout", filePath, "-").Output()
	if err != nil {
		return "", fmt.Errorf("pdftotext: %w", err)
	}
	return normalize(string(out)), nil
}

func ProcessImage(filePath string) (string, error) {
	tmpOut := filePath + ".ocr"
	defer os.Remove(tmpOut + ".txt")

	cmd := exec.Command("tesseract", filePath, tmpOut, "-l", "por", "--psm", "3")
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("tesseract: %w — %s", err, string(out))
	}

	data, err := os.ReadFile(tmpOut + ".txt")
	if err != nil {
		return "", fmt.Errorf("reading tesseract output: %w", err)
	}
	return normalize(string(data)), nil
}

func ExtractPatterns(text string) Patterns {
	return Patterns{
		CPFs:    unique(reCPF.FindAllString(text, -1)),
		CNPJs:   unique(reCNPJ.FindAllString(text, -1)),
		Dates:   unique(reDate.FindAllString(text, -1)),
		Amounts: unique(reAmount.FindAllString(text, -1)),
	}
}

func normalize(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	result := make([]string, 0, len(lines))
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return strings.Join(result, "\n")
}

func unique(ss []string) []string {
	seen := make(map[string]bool)
	out := []string{}
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}
