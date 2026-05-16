package document

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/keltech/auto-doc/internal/xmlparser"
	"github.com/keltech/auto-doc/pkg/apierr"
)

// ErrNotFound is returned when a document does not exist in the repository.
var ErrNotFound = errors.New("document not found")

// JobSubmitter abstracts the worker pool so that the document package does not
// import the worker package (which already imports document — cycle prevention).
type JobSubmitter interface {
	SubmitDoc(docID, filePath string, fileType FileType)
}

const maxFileSize = 25 * 1024 * 1024 // 25 MB

var (
	magicPDF = []byte("%PDF")
	magicPNG = []byte("\x89PNG")
)

type Service struct {
	repo      *Repository
	pool      JobSubmitter
	uploadDir string
}

func NewService(repo *Repository, pool JobSubmitter, uploadDir string) *Service {
	return &Service{repo: repo, pool: pool, uploadDir: uploadDir}
}

// Upload validates, stores and enqueues a document for processing.
func (s *Service) Upload(userID, originalFilename string, content []byte, fileType FileType) (*Document, error) {
	if int64(len(content)) > maxFileSize {
		return nil, apierr.BadRequest("file exceeds maximum allowed size of 25 MB")
	}

	if err := validateMagic(content, fileType); err != nil {
		return nil, err
	}

	ext := string(fileType)
	now := time.Now().UTC()
	storedPath := filepath.Join(
		s.uploadDir,
		fmt.Sprintf("%04d", now.Year()),
		fmt.Sprintf("%02d", now.Month()),
		uuid.New().String()+"."+ext,
	)

	if err := os.MkdirAll(filepath.Dir(storedPath), 0o755); err != nil {
		return nil, fmt.Errorf("create upload directory: %w", err)
	}

	if err := os.WriteFile(storedPath, content, 0o644); err != nil {
		return nil, fmt.Errorf("write file: %w", err)
	}

	doc := &Document{
		OriginalFilename: originalFilename,
		StoredPath:       storedPath,
		FileType:         fileType,
		FileSize:         int64(len(content)),
		CreatedBy:        userID,
	}

	if err := s.repo.Create(doc); err != nil {
		// Best-effort cleanup of the stored file on DB error.
		_ = os.Remove(storedPath)
		return nil, fmt.Errorf("create document record: %w", err)
	}

	s.pool.SubmitDoc(doc.ID, storedPath, fileType)

	return doc, nil
}

// GetByID retrieves a document by its ID.
func (s *Service) GetByID(id string) (*Document, error) {
	doc, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return nil, fmt.Errorf("find document: %w", err)
	}
	return doc, nil
}

// List returns a paginated list of documents matching the given filters.
func (s *Service) List(filters ListFilters) ([]Document, int, error) {
	docs, total, err := s.repo.List(filters)
	if err != nil {
		return nil, 0, fmt.Errorf("list documents: %w", err)
	}
	return docs, total, nil
}

// Delete removes a document record and its stored file from disk.
func (s *Service) Delete(id string) error {
	doc, err := s.GetByID(id)
	if err != nil {
		return err
	}
	_ = os.Remove(doc.StoredPath)
	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	return nil
}

// Enrich parses XML content and persists the enrichment data on a document.
func (s *Service) Enrich(id string, xmlContent []byte) (*Document, error) {
	// Verify document exists first.
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}

	enrichment, err := xmlparser.Parse(xmlContent)
	if err != nil {
		return nil, apierr.BadRequest(err.Error())
	}

	raw, err := json.Marshal(enrichment)
	if err != nil {
		return nil, fmt.Errorf("marshal enrichment: %w", err)
	}

	if err := s.repo.Enrich(id, json.RawMessage(raw)); err != nil {
		return nil, fmt.Errorf("persist enrichment: %w", err)
	}

	return s.GetByID(id)
}

// validateMagic checks file magic bytes for the declared file type.
func validateMagic(content []byte, fileType FileType) error {
	switch fileType {
	case TypePDF:
		if len(content) < len(magicPDF) || string(content[:len(magicPDF)]) != string(magicPDF) {
			return apierr.BadRequest("Arquivo inválido: o conteúdo não corresponde a um PDF.")
		}
	case TypePNG:
		if len(content) < len(magicPNG) || string(content[:len(magicPNG)]) != string(magicPNG) {
			return apierr.BadRequest("Arquivo inválido: o conteúdo não corresponde a um PNG.")
		}
	default:
		return apierr.BadRequest(fmt.Sprintf("Tipo de arquivo não suportado: %s", fileType))
	}
	return nil
}
