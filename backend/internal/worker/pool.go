package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/keltech/auto-doc/internal/document"
	"github.com/keltech/auto-doc/internal/ocr"
	"github.com/keltech/auto-doc/pkg/logger"
)

type Job struct {
	DocumentID string
	FilePath   string
	FileType   document.FileType
}

type Pool struct {
	jobs chan Job
	repo *document.Repository
}

func NewPool(size int, repo *document.Repository) *Pool {
	p := &Pool{
		jobs: make(chan Job, size*2),
		repo: repo,
	}
	for i := 0; i < size; i++ {
		go p.worker()
	}
	return p
}

func (p *Pool) Submit(job Job) {
	p.jobs <- job
}

// SubmitDoc satisfies the document.JobSubmitter interface without creating an
// import cycle (worker already imports document; document must not import worker).
func (p *Pool) SubmitDoc(docID, filePath string, fileType document.FileType) {
	p.jobs <- Job{DocumentID: docID, FilePath: filePath, FileType: fileType}
}

func (p *Pool) worker() {
	log := logger.Get()
	for job := range p.jobs {
		log.Info().Str("doc_id", job.DocumentID).Str("file", filepath.Base(job.FilePath)).Msg("processing started")

		if err := p.repo.UpdateStatus(job.DocumentID, document.StatusProcessing); err != nil {
			log.Error().Err(err).Str("doc_id", job.DocumentID).Msg("failed to update status to processing")
			continue
		}

		text, err := extractText(job)
		if err != nil {
			log.Error().Err(err).Str("doc_id", job.DocumentID).Msg("extraction failed")
			_ = p.repo.UpdateFailed(job.DocumentID, err.Error())
			continue
		}

		patterns := ocr.ExtractPatterns(text)
		docPatterns := document.Patterns{
			CPFs:    patterns.CPFs,
			CNPJs:   patterns.CNPJs,
			Dates:   patterns.Dates,
			Amounts: patterns.Amounts,
		}

		if err := p.repo.UpdateProcessed(job.DocumentID, text, docPatterns); err != nil {
			log.Error().Err(err).Str("doc_id", job.DocumentID).Msg("failed to save results")
			_ = p.repo.UpdateFailed(job.DocumentID, "failed to persist results")
			continue
		}

		log.Info().Str("doc_id", job.DocumentID).Msg("processing completed")
	}
}

func (p *Pool) Shutdown(ctx context.Context) {
	close(p.jobs)
}

func extractText(job Job) (string, error) {
	switch job.FileType {
	case document.TypePDF:
		return ocr.ProcessPDF(job.FilePath)
	case document.TypePNG:
		return ocr.ProcessImage(job.FilePath)
	default:
		return "", fmt.Errorf("unsupported file type: %s", job.FileType)
	}
}

// keep json import used via document.Patterns serialization
var _ = json.Marshal
