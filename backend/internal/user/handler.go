package user

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/keltech/auto-doc/internal/auth"
	"github.com/keltech/auto-doc/pkg/apierr"
	"github.com/keltech/auto-doc/pkg/logger"
)

// AuditLogger is the subset of auditlog.Logger used by this handler.
type AuditLogger interface {
	Log(userID, action, resourceType, resourceID, ip string, details any)
}

// Handler exposes user management endpoints over HTTP via Gin.
// All routes must be protected by admin-only middleware at the router level.
type Handler struct {
	repo  *Repository
	audit AuditLogger
}

// NewHandler creates a new Handler backed by the given repository.
func NewHandler(repo *Repository, audit AuditLogger) *Handler {
	return &Handler{repo: repo, audit: audit}
}

// List handles GET /users — returns the full list of users.
func (h *Handler) List(c *gin.Context) {
	users, err := h.repo.List()
	if err != nil {
		logger.Get().Error().Err(err).Msg("user list failed")
		apierr.Abort(c, apierr.Internal())
		return
	}
	if users == nil {
		users = []User{}
	}
	c.JSON(http.StatusOK, users)
}

// createRequest is the expected JSON body for POST /users.
type createRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Create handles POST /users — creates a new user.
func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Abort(c, apierr.BadRequest("invalid JSON body"))
		return
	}

	if req.Email == "" {
		apierr.Abort(c, apierr.BadRequest("O e-mail é obrigatório."))
		return
	}
	if len(req.Password) < 8 {
		apierr.Abort(c, apierr.BadRequest("A senha deve ter pelo menos 8 caracteres."))
		return
	}
	if req.Role != string(RoleOperator) && req.Role != string(RoleManager) && req.Role != string(RoleAdmin) {
		apierr.Abort(c, apierr.BadRequest("Perfil inválido. Use: operator, manager ou admin."))
		return
	}

	u, err := h.repo.Create(req.Email, req.Name, req.Password, req.Role)
	if err != nil {
		if errors.Is(err, ErrEmailConflict) {
			apierr.Abort(c, apierr.Conflict("E-mail já está em uso."))
			return
		}
		logger.Get().Error().Err(err).Msg("user create failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	if claims := auth.GetClaims(c); claims != nil {
		h.audit.Log(claims.UserID, "user.create", "user", u.ID, c.ClientIP(), map[string]string{
			"email": u.Email,
			"role":  string(u.Role),
		})
	}

	c.JSON(http.StatusCreated, u)
}

// updateRequest is the expected JSON body for PUT /users/:id.
type updateRequest struct {
	Name   string `json:"name"`
	Role   Role   `json:"role"`
	Active bool   `json:"active"`
}

// Update handles PUT /users/:id — updates an existing user.
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")

	var req updateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Abort(c, apierr.BadRequest("invalid JSON body"))
		return
	}
	if req.Name == "" {
		apierr.Abort(c, apierr.BadRequest("O nome é obrigatório."))
		return
	}
	if req.Role != RoleOperator && req.Role != RoleManager && req.Role != RoleAdmin {
		apierr.Abort(c, apierr.BadRequest("Perfil inválido. Use: operator, manager ou admin."))
		return
	}

	u, err := h.repo.Update(id, req.Name, req.Role, req.Active)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			apierr.Abort(c, apierr.NotFound("Usuário não encontrado."))
			return
		}
		logger.Get().Error().Err(err).Str("user_id", id).Msg("user update failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	if claims := auth.GetClaims(c); claims != nil {
		h.audit.Log(claims.UserID, "user.update", "user", id, c.ClientIP(), map[string]any{
			"email":  u.Email,
			"role":   string(u.Role),
			"active": u.Active,
		})
	}

	c.JSON(http.StatusOK, u)
}

// Delete handles DELETE /users/:id — permanently removes a user.
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.repo.Delete(id); err != nil {
		if errors.Is(err, ErrNotFound) {
			apierr.Abort(c, apierr.NotFound("Usuário não encontrado."))
			return
		}
		logger.Get().Error().Err(err).Str("user_id", id).Msg("user delete failed")
		apierr.Abort(c, apierr.Internal())
		return
	}

	if claims := auth.GetClaims(c); claims != nil {
		h.audit.Log(claims.UserID, "user.delete", "user", id, c.ClientIP(), nil)
	}

	c.Status(http.StatusNoContent)
}
