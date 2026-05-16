package xmlparser

import (
	"encoding/xml"
	"fmt"
)

type Enrichment struct {
	XMLName       xml.Name  `xml:"documento"   json:"-"`
	Referencia    string    `xml:"referencia"  json:"referencia"`
	Cliente       Cliente   `xml:"cliente"     json:"cliente"`
	Classificacao string    `xml:"classificacao" json:"classificacao"`
	Periodo       *Periodo  `xml:"periodo"     json:"periodo,omitempty"`
	Metadados     []Campo   `xml:"metadados>campo" json:"metadados,omitempty"`
}

type Cliente struct {
	Codigo string `xml:"codigo" json:"codigo"`
	Nome   string `xml:"nome"   json:"nome"`
	CNPJ   string `xml:"cnpj"   json:"cnpj"`
}

type Periodo struct {
	Inicio string `xml:"inicio" json:"inicio"`
	Fim    string `xml:"fim"    json:"fim"`
}

type Campo struct {
	Chave string `xml:"chave,attr" json:"chave"`
	Valor string `xml:",chardata"  json:"valor"`
}

func Parse(data []byte) (*Enrichment, error) {
	var doc Enrichment
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("xml parse error: %w", err)
	}
	if err := validate(&doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func validate(doc *Enrichment) error {
	if doc.Referencia == "" {
		return fmt.Errorf("campo obrigatório ausente: referencia")
	}
	if doc.Cliente.Nome == "" {
		return fmt.Errorf("campo obrigatório ausente: cliente.nome")
	}
	allowed := map[string]bool{"fiscal": true, "contabil": true, "juridico": true, "outro": true}
	if doc.Classificacao != "" && !allowed[doc.Classificacao] {
		return fmt.Errorf("classificacao inválida: %q (aceitos: fiscal, contabil, juridico, outro)", doc.Classificacao)
	}
	return nil
}
