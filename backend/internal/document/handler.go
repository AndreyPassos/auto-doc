package document

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/keltech/auto-doc/internal/auth"
	"github.com/keltech/auto-doc/pkg/apierr"
	"github.com/keltech/auto-doc/pkg/logger"
)

// AuditLogger is the subset of auditlog.Logger used by this handler.
type AuditLogger interface {
	Log(userID, action, resourceType, resourceID, ip string, details any)
}

// Handler exposes the document service over HTTP via Gin.
type Handler struct {
	svc   *Service
	audit AuditLogger
}

// NewHandler creates a new Handler.
func NewHandler(svc *Service, audit AuditLogger) *Handler {
	return &Handler{svc: svc, audit: audit}
}

// Upload handles POST /documents.
// Expects a multipart form with a file field named "file".
func (h *Handler) Upload(c *gin.Context) {
	claims := auth.GetClaims(c)
	if claims == nil {
		apierr.Abort(c, apierr.Unauthorized())
		return
	}
	uid := claims.UserID

	fh, err := c.FormFile("file")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("Nenhum arquivo enviado. Selecione um arquivo PDF ou PNG."))
		return
	}

	const maxUploadSize = 25 * 1024 * 1024
	if fh.Size > maxUploadSize {
		apierr.Abort(c, apierr.BadRequest("O arquivo excede o limite de 25 MB."))
		return
	}

	f, err := fh.Open()
	if err != nil {
		apierr.Abort(c, apierr.Internal())
		return
	}
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		apierr.Abort(c, apierr.Internal())
		return
	}

	fileType, err := detectFileType(content)
	if err != nil {
		apierr.Abort(c, apierr.BadRequest(err.Error()))
		return
	}

	doc, err := h.svc.Upload(uid, fh.Filename, content, fileType)
	if err != nil {
		var apiErr apierr.APIError
		if errors.As(err, &apiErr) {
			apierr.Abort(c, apiErr)
		} else {
			logger.Get().Error().Err(err).Msg("upload failed")
			apierr.Abort(c, apierr.Internal())
		}
		return
	}

	h.audit.Log(uid, "document.upload", "document", doc.ID, c.ClientIP(), map[string]any{
		"filename":  doc.OriginalFilename,
		"file_type": doc.FileType,
		"size":      doc.FileSize,
	})

	c.JSON(http.StatusCreated, doc)
}

// GetByID handles GET /documents/:id.
func (h *Handler) GetByID(c *gin.Context) {
	id := c.Param("id")
	doc, err := h.svc.GetByID(id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			apierr.Abort(c, apierr.NotFound("Documento não encontrado."))
			return
		}
		apierr.Abort(c, apierr.Internal())
		return
	}
	c.JSON(http.StatusOK, doc)
}

// List handles GET /documents.
// Accepted query params: status, type, from, to, enriched, page, page_size.
func (h *Handler) List(c *gin.Context) {
	filters := ListFilters{
		Status:   c.Query("status"),
		FileType: c.Query("type"),
		Page:     parseIntParam(c, "page", 1),
		PageSize: parseIntParam(c, "page_size", 20),
	}

	if raw := c.Query("from"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			apierr.Abort(c, apierr.BadRequest("'from' must be RFC3339 (e.g. 2024-01-01T00:00:00Z)"))
			return
		}
		filters.From = &t
	}

	if raw := c.Query("to"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			apierr.Abort(c, apierr.BadRequest("'to' must be RFC3339 (e.g. 2024-12-31T23:59:59Z)"))
			return
		}
		filters.To = &t
	}

	if raw := c.Query("enriched"); raw != "" {
		b, err := strconv.ParseBool(raw)
		if err != nil {
			apierr.Abort(c, apierr.BadRequest("'enriched' must be true or false"))
			return
		}
		filters.Enriched = &b
	}

	docs, total, err := h.svc.List(filters)
	if err != nil {
		apierr.Abort(c, apierr.Internal())
		return
	}

	// Ensure JSON response contains an empty array instead of null.
	if docs == nil {
		docs = []Document{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      docs,
		"total":     total,
		"page":      filters.Page,
		"page_size": filters.PageSize,
	})
}

// Enrich handles POST /documents/:id/enrich.
// Expects a multipart form with a file field named "xml".
func (h *Handler) Enrich(c *gin.Context) {
	id := c.Param("id")

	fh, err := c.FormFile("xml")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("Nenhum arquivo XML enviado."))
		return
	}

	const maxXMLSize = 5 * 1024 * 1024
	if fh.Size > maxXMLSize {
		apierr.Abort(c, apierr.BadRequest("O arquivo XML excede o limite de 5 MB."))
		return
	}

	f, err := fh.Open()
	if err != nil {
		apierr.Abort(c, apierr.Internal())
		return
	}
	defer f.Close()

	xmlContent, err := io.ReadAll(f)
	if err != nil {
		apierr.Abort(c, apierr.Internal())
		return
	}

	doc, err := h.svc.Enrich(id, xmlContent)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			apierr.Abort(c, apierr.NotFound("Documento não encontrado."))
			return
		}
		var apiErr apierr.APIError
		if errors.As(err, &apiErr) {
			apierr.Abort(c, apiErr)
		} else {
			logger.Get().Error().Err(err).Str("doc_id", id).Msg("enrich failed")
			apierr.Abort(c, apierr.Internal())
		}
		return
	}

	claims := auth.GetClaims(c)
	uid := ""
	if claims != nil {
		uid = claims.UserID
	}
	h.audit.Log(uid, "document.enrich", "document", id, c.ClientIP(), map[string]string{
		"filename": doc.OriginalFilename,
	})

	c.JSON(http.StatusOK, doc)
}

// Delete handles DELETE /documents/:id — permanently removes a document (admin only).
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	doc, _ := h.svc.GetByID(id)

	if err := h.svc.Delete(id); err != nil {
		if errors.Is(err, ErrNotFound) {
			apierr.Abort(c, apierr.NotFound("document not found"))
			return
		}
		logger.Get().Error().Err(err).Str("doc_id", id).Msg("document delete failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	claims := auth.GetClaims(c)
	uid := ""
	if claims != nil {
		uid = claims.UserID
	}
	filename := id
	if doc != nil {
		filename = doc.OriginalFilename
	}
	h.audit.Log(uid, "document.delete", "document", id, c.ClientIP(), map[string]string{
		"filename": filename,
	})

	c.Status(http.StatusNoContent)
}

// detectFileType inspects magic bytes to identify a supported file type.
func detectFileType(content []byte) (FileType, error) {
	if len(content) >= 4 && string(content[:4]) == "%PDF" {
		return TypePDF, nil
	}
	if len(content) >= 4 && string(content[:4]) == "\x89PNG" {
		return TypePNG, nil
	}
	return "", errors.New("Tipo de arquivo não suportado. Envie um PDF ou PNG.")
}

// parseIntParam reads an integer query parameter with a fallback default.
func parseIntParam(c *gin.Context, key string, def int) int {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 {
		return def
	}
	return v
}
