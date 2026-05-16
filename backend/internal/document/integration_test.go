//go:build integration

package document_test

import (
	"os"
	"testing"

	"github.com/keltech/auto-doc/internal/db"
	"github.com/keltech/auto-doc/internal/document"
)

// noopPool satisfies document.JobSubmitter without starting a real worker pool.
type noopPool struct{}

func (n *noopPool) SubmitDoc(_, _ string, _ document.FileType) {}

// minimalPDF is a byte slice with valid PDF magic bytes.
var minimalPDF = []byte("%PDF-1.4 1 0 obj<</Type/Catalog>>")

// setup connects to the DB, runs migrations, and returns a repo and a cleanup function.
func setup(t *testing.T) (*document.Repository, func()) {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}

	sqlxDB, err := db.Connect(dsn)
	if err != nil {
		t.Fatalf("db.Connect: %v", err)
	}

	if err := db.RunMigrations(dsn, "../../migrations"); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	repo := document.NewRepository(sqlxDB)

	cleanup := func() {
		sqlxDB.Close()
	}

	return repo, cleanup
}

// createTestUser inserts a minimal user row and returns its UUID.
func createTestUser(t *testing.T, sqlxDB interface{ QueryRow(string, ...interface{}) interface{ Scan(...interface{}) error } }) string {
	t.Helper()
	var userID string
	err := sqlxDB.QueryRow(
		`INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
		"testuser@example.com", "hashed_password", "Test User", "operator",
	).Scan(&userID)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	return userID
}

func TestUpload_CreatesPendingDocument(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}

	sqlxDB, err := db.Connect(dsn)
	if err != nil {
		t.Fatalf("db.Connect: %v", err)
	}
	defer sqlxDB.Close()

	if err := db.RunMigrations(dsn, "../../migrations"); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	repo := document.NewRepository(sqlxDB)

	// Create a test user required by the FK constraint.
	var userID string
	err = sqlxDB.QueryRow(
		`INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
		"upload_test@example.com", "hashed_password", "Upload Test User", "operator",
	).Scan(&userID)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}

	t.Cleanup(func() {
		sqlxDB.Exec(`DELETE FROM documents WHERE created_by = $1`, userID)
		sqlxDB.Exec(`DELETE FROM users WHERE id = $1`, userID)
	})

	uploadDir := t.TempDir()
	svc := document.NewService(repo, &noopPool{}, uploadDir)

	doc, err := svc.Upload(userID, "test.pdf", minimalPDF, document.TypePDF)
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}

	if doc.Status != document.StatusPending {
		t.Errorf("status: got %q, want %q", doc.Status, document.StatusPending)
	}

	fetched, err := repo.FindByID(doc.ID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if fetched.ID != doc.ID {
		t.Errorf("ID mismatch: got %q, want %q", fetched.ID, doc.ID)
	}
	if fetched.Status != document.StatusPending {
		t.Errorf("DB status: got %q, want %q", fetched.Status, document.StatusPending)
	}
}

func TestDocument_StatusUpdates(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}

	sqlxDB, err := db.Connect(dsn)
	if err != nil {
		t.Fatalf("db.Connect: %v", err)
	}
	defer sqlxDB.Close()

	if err := db.RunMigrations(dsn, "../../migrations"); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	repo := document.NewRepository(sqlxDB)

	// Create a test user required by the FK constraint.
	var userID string
	err = sqlxDB.QueryRow(
		`INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
		"status_test@example.com", "hashed_password", "Status Test User", "operator",
	).Scan(&userID)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}

	t.Cleanup(func() {
		sqlxDB.Exec(`DELETE FROM documents WHERE created_by = $1`, userID)
		sqlxDB.Exec(`DELETE FROM users WHERE id = $1`, userID)
	})

	uploadDir := t.TempDir()
	svc := document.NewService(repo, &noopPool{}, uploadDir)

	// Create a document (status = pending).
	doc, err := svc.Upload(userID, "test.pdf", minimalPDF, document.TypePDF)
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}

	// Update to completed with extracted text and patterns.
	patterns := document.Patterns{
		Dates: []string{"01/01/2024"},
	}
	if err := repo.UpdateProcessed(doc.ID, "extracted text", patterns); err != nil {
		t.Fatalf("UpdateProcessed: %v", err)
	}

	// Fetch and assert the updated state.
	fetched, err := repo.FindByID(doc.ID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}

	if fetched.Status != document.StatusCompleted {
		t.Errorf("status: got %q, want %q", fetched.Status, document.StatusCompleted)
	}

	if fetched.ExtractedText == nil {
		t.Fatal("extracted_text: got nil, want non-nil")
	}
	if *fetched.ExtractedText != "extracted text" {
		t.Errorf("extracted_text: got %q, want %q", *fetched.ExtractedText, "extracted text")
	}
}
