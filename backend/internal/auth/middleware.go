package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/keltech/auto-doc/pkg/apierr"
)

const claimsKey = "claims"

func RequireAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			apierr.Abort(c, apierr.Unauthorized())
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			apierr.Abort(c, apierr.Unauthorized())
			return
		}
		c.Set(claimsKey, claims)
		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil || !allowed[claims.Role] {
			apierr.Abort(c, apierr.Forbidden())
			return
		}
		c.Next()
	}
}

func GetClaims(c *gin.Context) *Claims {
	v, exists := c.Get(claimsKey)
	if !exists {
		return nil
	}
	claims, _ := v.(*Claims)
	return claims
}
