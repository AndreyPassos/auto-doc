package report

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/keltech/auto-doc/pkg/apierr"
	"github.com/keltech/auto-doc/pkg/logger"
)

// Handler exposes the report service over HTTP via Gin.
type Handler struct {
	svc *Service
}

// NewHandler creates a new report Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Summary handles GET /reports/summary.
// Optional query params: from, to (RFC3339 or yyyy-mm-dd).
func (h *Handler) Summary(c *gin.Context) {
	from, err := parseOptionalDate(c, "from")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("'from' must be RFC3339 or yyyy-mm-dd"))
		return
	}
	to, err := parseOptionalDate(c, "to")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("'to' must be RFC3339 or yyyy-mm-dd"))
		return
	}

	report, err := h.svc.Summary(from, to)
	if err != nil {
		logger.Get().Error().Err(err).Msg("report summary failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	c.JSON(http.StatusOK, report)
}

// List handles GET /reports/documents.
// Query params: status, type, from, to, enriched, page, page_size.
func (h *Handler) List(c *gin.Context) {
	from, err := parseOptionalDate(c, "from")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("'from' must be RFC3339 or yyyy-mm-dd"))
		return
	}
	to, err := parseOptionalDate(c, "to")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("'to' must be RFC3339 or yyyy-mm-dd"))
		return
	}

	filters := ListFilters{
		Status:   c.Query("status"),
		FileType: c.Query("type"),
		From:     from,
		To:       to,
		Page:     parseIntParam(c, "page", 1),
		PageSize: parseIntParam(c, "page_size", 20),
	}

	if raw := c.Query("enriched"); raw != "" {
		b, err := strconv.ParseBool(raw)
		if err != nil {
			apierr.Abort(c, apierr.BadRequest("'enriched' must be true or false"))
			return
		}
		filters.Enriched = &b
	}

	rows, total, err := h.svc.List(filters)
	if err != nil {
		logger.Get().Error().Err(err).Msg("report list failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      rows,
		"total":     total,
		"page":      filters.Page,
		"page_size": filters.PageSize,
	})
}

// Export handles GET /reports/export.
// Query params: format (default: csv), from, to, status.
func (h *Handler) Export(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")
	if format != "csv" {
		apierr.Abort(c, apierr.BadRequest("only 'csv' format is supported"))
		return
	}

	from, err := parseOptionalDate(c, "from")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("'from' must be RFC3339 or yyyy-mm-dd"))
		return
	}
	to, err := parseOptionalDate(c, "to")
	if err != nil {
		apierr.Abort(c, apierr.BadRequest("'to' must be RFC3339 or yyyy-mm-dd"))
		return
	}

	status := c.Query("status")

	data, err := h.svc.ExportCSV(from, to, status)
	if err != nil {
		logger.Get().Error().Err(err).Msg("report export failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	c.Header("Content-Disposition", `attachment; filename="report.csv"`)
	c.Data(http.StatusOK, "text/csv", data)
}

// parseOptionalDate reads a query param and tries RFC3339, then yyyy-mm-dd.
// Returns nil, nil when the param is absent.
func parseOptionalDate(c *gin.Context, key string) (*time.Time, error) {
	raw := c.Query(key)
	if raw == "" {
		return nil, nil
	}
	// Try RFC3339 first.
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t, nil
	}
	// Fallback to date-only format.
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return &t, nil
	}
	return nil, errInvalidDate
}

// errInvalidDate is a sentinel used internally by parseOptionalDate.
var errInvalidDate = apierr.BadRequest("invalid date")

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
