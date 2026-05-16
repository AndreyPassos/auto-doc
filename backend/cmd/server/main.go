package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/keltech/auto-doc/internal/auth"
	"github.com/keltech/auto-doc/internal/db"
	"github.com/keltech/auto-doc/internal/document"
	"github.com/keltech/auto-doc/internal/report"
	"github.com/keltech/auto-doc/internal/user"
	"github.com/keltech/auto-doc/internal/worker"
	"github.com/keltech/auto-doc/pkg/logger"
	"golang.org/x/crypto/bcrypt"
)

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return defaultVal
}

func main() {
	// --- Config ---
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		fmt.Fprintln(os.Stderr, "JWT_SECRET is required")
		os.Exit(1)
	}
	jwtExpiryHours := getEnvInt("JWT_EXPIRY_HOURS", 24)
	jwtExpiry := time.Duration(jwtExpiryHours) * time.Hour
	uploadDir := getEnv("UPLOAD_DIR", "/var/uploads")
	port := getEnv("PORT", "8080")
	env := getEnv("ENV", "production")
	workerPoolSize := getEnvInt("WORKER_POOL_SIZE", 4)
	migrationsPath := getEnv("MIGRATIONS_PATH", "./migrations")
	adminEmail := getEnv("ADMIN_EMAIL", "admin@autodoc.local")

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "changeme"
		// Warn loudly — a known default password is a security risk.
		fmt.Fprintln(os.Stderr, "WARNING: ADMIN_PASSWORD not set, using insecure default 'changeme'")
	}

	// 1. Init logger
	logger.Init(env)
	log := logger.Get()

	// 2. Connect to PostgreSQL (DSN not logged to avoid leaking credentials)
	log.Info().Msg("connecting to database")
	database, err := db.Connect(dsn)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer database.Close()
	log.Info().Msg("database connected")

	// 3. Run migrations
	log.Info().Str("path", migrationsPath).Msg("running migrations")
	if err := db.RunMigrations(dsn, migrationsPath); err != nil {
		log.Fatal().Err(err).Msg("failed to run migrations")
	}
	log.Info().Msg("migrations applied")

	// 4. Seed admin user if no users exist
	var userCount int
	if err := database.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		log.Fatal().Err(err).Msg("failed to count users")
	}
	if userCount == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), 12)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to hash admin password")
		}
		_, err = database.Exec(
			`INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4)`,
			adminEmail, "Admin", string(hash), "admin",
		)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to seed admin user")
		}
		log.Info().Str("email", adminEmail).Msg("admin user seeded")
	}

	// 5. Create worker pool
	docRepo := document.NewRepository(database)
	pool := worker.NewPool(workerPoolSize, docRepo)
	log.Info().Int("size", workerPoolSize).Msg("worker pool started")

	// 6. Build Gin router
	if env != "development" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Recovery must be outermost so it can catch panics from any middleware below it.
	router.Use(gin.Recovery())
	router.Use(requestLogger())

	// Health check (no auth)
	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Handlers
	authHandler := auth.NewHandler(database, jwtSecret, jwtExpiry)
	docSvc := document.NewService(docRepo, pool, uploadDir)
	docHandler := document.NewHandler(docSvc)
	reportSvc := report.NewService(database)
	reportHandler := report.NewHandler(reportSvc)
	userRepo := user.NewRepository(database)
	userHandler := user.NewHandler(userRepo)

	// Auth routes
	authRoutes := router.Group("/api/v1/auth")
	{
		authRoutes.POST("/login", authHandler.Login)
		authRoutes.GET("/me", auth.RequireAuth(jwtSecret), authHandler.Me)
	}

	// Document routes (require auth)
	docRoutes := router.Group("/api/v1/documents", auth.RequireAuth(jwtSecret))
	{
		docRoutes.POST("", docHandler.Upload)
		docRoutes.GET("", docHandler.List)
		docRoutes.GET("/:id", docHandler.GetByID)
		docRoutes.POST("/:id/enrich", docHandler.Enrich)
		docRoutes.DELETE("/:id", auth.RequireRole("admin"), docHandler.Delete)
	}

	// Report routes (require auth)
	reportRoutes := router.Group("/api/v1/reports", auth.RequireAuth(jwtSecret))
	{
		reportRoutes.GET("/summary", reportHandler.Summary)
		reportRoutes.GET("/documents", reportHandler.List)
		reportRoutes.GET("/export", reportHandler.Export)
	}

	// User routes (require auth + admin role)
	userRoutes := router.Group("/api/v1/users",
		auth.RequireAuth(jwtSecret),
		auth.RequireRole("admin"),
	)
	{
		userRoutes.GET("", userHandler.List)
		userRoutes.POST("", userHandler.Create)
		userRoutes.PUT("/:id", userHandler.Update)
		userRoutes.DELETE("/:id", userHandler.Delete)
	}

	// 7. HTTP server with read/write timeouts and graceful shutdown
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
	}

	go func() {
		log.Info().Str("port", port).Msg("HTTP server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	log.Info().Msg("shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Drain the worker pool before stopping the HTTP server so in-flight
	// OCR jobs complete rather than being abandoned mid-processing.
	pool.Shutdown(ctx)

	if err := srv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("server shutdown error")
	}
	log.Info().Msg("server stopped")
}

// requestLogger returns a Gin middleware that logs each request with zerolog.
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		logger.Get().Info().
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(start)).
			Msg("request")
	}
}
