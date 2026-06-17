package router

import (
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetApiRouterDoesNotPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	SetApiRouter(engine)
}
