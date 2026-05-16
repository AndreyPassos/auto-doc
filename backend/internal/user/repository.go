package user

import (
	"database/sql"
	"errors"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// Repository handles all database operations for users.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given database.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// List returns all users ordered by creation date descending.
func (r *Repository) List() ([]User, error) {
	var users []User
	err := r.db.Select(&users, `
		SELECT id, email, name, role, active, created_at, updated_at
		FROM users
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	return users, nil
}

// FindByID returns the user with the given ID or an error if not found.
func (r *Repository) FindByID(id string) (*User, error) {
	var u User
	err := r.db.Get(&u, `
		SELECT id, email, name, role, active, created_at, updated_at
		FROM users
		WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// Create inserts a new user with a bcrypt-hashed password and returns the
// created record (without the password hash).
func (r *Repository) Create(email, name, password, role string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	var u User
	err = r.db.QueryRowx(`
		INSERT INTO users (email, name, password, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, name, role, active, created_at, updated_at`,
		email, name, string(hash), role,
	).StructScan(&u)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, ErrEmailConflict
		}
		return nil, err
	}
	return &u, nil
}

// Update modifies the name, role and active flag of an existing user and
// returns the updated record.
func (r *Repository) Update(id string, name string, role Role, active bool) (*User, error) {
	var u User
	err := r.db.QueryRowx(`
		UPDATE users
		SET name = $2, role = $3, active = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING id, email, name, role, active, created_at, updated_at`,
		id, name, role, active,
	).StructScan(&u)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// Delete permanently removes a user from the database.
func (r *Repository) Delete(id string) error {
	result, err := r.db.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// Sentinel errors used across the user package.
var (
	ErrNotFound      = errors.New("user not found")
	ErrEmailConflict = errors.New("email already in use")
)
