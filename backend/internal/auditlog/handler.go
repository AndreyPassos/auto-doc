package auditlog

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/keltech/auto-doc/pkg/apierr"
)

// Handler exposes audit log read endpoints for admins.
type Handler struct {
	log *Logger
}

func NewHandler(log *Logger) *Handler {
	return &Handler{log: log}
}

// List handles GET /api/v1/admin/logs.
// Query params: action, page, page_size.
func (h *Handler) List(c *gin.Context) {
	f := ListFilters{
		Action:   c.Query("action"),
		Page:     parseIntParam(c, "page", 1),
		PageSize: parseIntParam(c, "page_size", 50),
	}

	entries, total, err := h.log.List(f)
	if err != nil {
		apierr.Abort(c, apierr.Internal())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      entries,
		"total":     total,
		"page":      f.Page,
		"page_size": f.PageSize,
	})
}

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
