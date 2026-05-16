package worker

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

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
	wg   sync.WaitGroup
}

func NewPool(size int, repo *document.Repository) *Pool {
	p := &Pool{
		jobs: make(chan Job, size*2),
		repo: repo,
	}
	for i := 0; i < size; i++ {
		p.wg.Add(1)
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
	defer p.wg.Done()
	log := logger.Get()
	for job := range p.jobs {
		p.processJob(job)
		log.Info().Str("doc_id", job.DocumentID).Msg("processing completed")
	}
}

func (p *Pool) processJob(job Job) {
	log := logger.Get()

	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Str("doc_id", job.DocumentID).Msg("worker panic recovered")
			_ = p.repo.UpdateFailed(job.DocumentID, "Falha inesperada durante o processamento. Tente enviar o arquivo novamente.")
		}
	}()

	log.Info().Str("doc_id", job.DocumentID).Str("file", filepath.Base(job.FilePath)).Msg("processing started")

	if err := p.repo.UpdateStatus(job.DocumentID, document.StatusProcessing); err != nil {
		log.Error().Err(err).Str("doc_id", job.DocumentID).Msg("failed to update status to processing")
		return
	}

	text, err := extractText(job)
	if err != nil {
		log.Error().Err(err).Str("doc_id", job.DocumentID).Msg("extraction failed")
		_ = p.repo.UpdateFailed(job.DocumentID, friendlyExtractionError(err))
		return
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
		_ = p.repo.UpdateFailed(job.DocumentID, "Erro ao salvar os resultados. Tente enviar o arquivo novamente.")
	}
}

// Shutdown stops accepting new jobs, waits for in-flight jobs to finish (or
// until ctx is cancelled), then returns.
func (p *Pool) Shutdown(ctx context.Context) {
	close(p.jobs)
	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
	}
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

// friendlyExtractionError translates a low-level OCR error into a message
// suitable for display to the end user. The original error is always logged
// separately so technical details remain available for debugging.
func friendlyExtractionError(err error) string {
	msg := err.Error()
	switch {
	case strings.HasPrefix(msg, "pdftotext:"):
		return "Não foi possível extrair o texto do PDF. " +
			"O arquivo pode estar corrompido, protegido por senha ou não conter uma camada de texto legível."
	case strings.HasPrefix(msg, "tesseract:"):
		return "Falha no reconhecimento de texto (OCR). " +
			"Verifique se a imagem está nítida, com boa iluminação e resolução mínima de 150 DPI."
	case strings.HasPrefix(msg, "reading tesseract output:"):
		return "Erro interno ao ler o resultado do OCR. Tente enviar o arquivo novamente."
	case strings.HasPrefix(msg, "unsupported file type:"):
		return "Tipo de arquivo não suportado pelo processador. Envie um PDF ou PNG."
	default:
		return "Falha inesperada durante o processamento. Tente enviar o arquivo novamente."
	}
}
