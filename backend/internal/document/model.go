package document

import (
	"encoding/json"
	"time"
)

type Status string
type FileType string

const (
	StatusPending    Status = "pending"
	StatusProcessing Status = "processing"
	StatusCompleted  Status = "completed"
	StatusFailed     Status = "failed"

	TypePDF FileType = "pdf"
	TypePNG FileType = "png"
)

type Patterns struct {
	CPFs    []string `json:"cpf"`
	CNPJs   []string `json:"cnpj"`
	Dates   []string `json:"dates"`
	Amounts []string `json:"amounts"`
}

type Document struct {
	ID               string           `db:"id"                json:"id"`
	OriginalFilename string           `db:"original_filename" json:"original_filename"`
	StoredPath       string           `db:"stored_path"       json:"-"`
	FileType         FileType         `db:"file_type"         json:"file_type"`
	FileSize         int64            `db:"file_size"         json:"file_size"`
	Status           Status           `db:"status"            json:"status"`
	ExtractedText    *string          `db:"extracted_text"    json:"extracted_text,omitempty"`
	Patterns         *json.RawMessage `db:"patterns"          json:"patterns,omitempty"`
	XMLEnriched      bool             `db:"xml_enriched"      json:"xml_enriched"`
	XMLData          *json.RawMessage `db:"xml_data"          json:"xml_data,omitempty"`
	XMLEnrichedAt    *time.Time       `db:"xml_enriched_at"   json:"xml_enriched_at,omitempty"`
	ErrorMessage     *string          `db:"error_message"     json:"error_message,omitempty"`
	CreatedBy        string           `db:"created_by"        json:"created_by"`
	CreatedAt        time.Time        `db:"created_at"        json:"created_at"`
	UpdatedAt        time.Time        `db:"updated_at"        json:"updated_at"`
}

type ListFilters struct {
	Status   string
	FileType string
	From     *time.Time
	To       *time.Time
	Enriched *bool
	Page     int
	PageSize int
}
