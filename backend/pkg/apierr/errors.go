package apierr

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type APIError struct {
	Code    int    `json:"-"`
	Message string `json:"error"`
}

func (e APIError) Error() string { return e.Message }

func NotFound(msg string) APIError   { return APIError{Code: http.StatusNotFound, Message: msg} }
func BadRequest(msg string) APIError { return APIError{Code: http.StatusBadRequest, Message: msg} }
func Unauthorized() APIError         { return APIError{Code: http.StatusUnauthorized, Message: "unauthorized"} }
func Forbidden() APIError            { return APIError{Code: http.StatusForbidden, Message: "forbidden"} }
func Internal() APIError             { return APIError{Code: http.StatusInternalServerError, Message: "internal server error"} }
func Conflict(msg string) APIError   { return APIError{Code: http.StatusConflict, Message: msg} }

func Abort(c *gin.Context, err APIError) {
	c.AbortWithStatusJSON(err.Code, err)
}

func Respond(c *gin.Context, err APIError) {
	c.JSON(err.Code, err)
}
