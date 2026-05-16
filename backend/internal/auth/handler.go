package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/keltech/auto-doc/pkg/apierr"
	"golang.org/x/crypto/bcrypt"
)

// AuditLogger is the subset of auditlog.Logger used by this handler,
// defined here to avoid an import cycle.
type AuditLogger interface {
	Log(userID, action, resourceType, resourceID, ip string, details any)
}

type Handler struct {
	db        *sqlx.DB
	jwtSecret string
	jwtExpiry time.Duration
	audit     AuditLogger
}

func NewHandler(db *sqlx.DB, jwtSecret string, jwtExpiry time.Duration, audit AuditLogger) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, jwtExpiry: jwtExpiry, audit: audit}
}

type loginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type userResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Respond(c, apierr.BadRequest(err.Error()))
		return
	}

	var user struct {
		ID       string `db:"id"`
		Email    string `db:"email"`
		Name     string `db:"name"`
		Role     string `db:"role"`
		Password string `db:"password"`
		Active   bool   `db:"active"`
	}
	if err := h.db.Get(&user, `SELECT id, email, name, role, password, active FROM users WHERE email = $1`, req.Email); err != nil {
		apierr.Respond(c, apierr.Unauthorized())
		return
	}
	if !user.Active {
		apierr.Respond(c, apierr.Unauthorized())
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		h.audit.Log("", "auth.login_failed", "", "", c.ClientIP(), map[string]string{"email": req.Email})
		apierr.Respond(c, apierr.Unauthorized())
		return
	}

	token, err := GenerateToken(user.ID, user.Email, user.Role, h.jwtSecret, h.jwtExpiry)
	if err != nil {
		apierr.Respond(c, apierr.Internal())
		return
	}

	h.audit.Log(user.ID, "auth.login", "", "", c.ClientIP(), map[string]string{"email": user.Email})

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  userResponse{ID: user.ID, Email: user.Email, Name: user.Name, Role: user.Role},
	})
}

func (h *Handler) Me(c *gin.Context) {
	claims := GetClaims(c)

	var user struct {
		ID    string `db:"id"`
		Email string `db:"email"`
		Name  string `db:"name"`
		Role  string `db:"role"`
	}
	if err := h.db.Get(&user, `SELECT id, email, name, role FROM users WHERE id = $1`, claims.UserID); err != nil {
		apierr.Respond(c, apierr.NotFound("user not found"))
		return
	}
	c.JSON(http.StatusOK, userResponse{ID: user.ID, Email: user.Email, Name: user.Name, Role: user.Role})
}
