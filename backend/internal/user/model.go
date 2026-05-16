package user

import "time"

// Role represents the access level of a user in the system.
type Role string

const (
	RoleOperator Role = "operator"
	RoleManager  Role = "manager"
	RoleAdmin    Role = "admin"
)

// User represents a system user. The password hash is never serialised to JSON.
type User struct {
	ID        string    `db:"id"         json:"id"`
	Email     string    `db:"email"      json:"email"`
	Name      string    `db:"name"       json:"name"`
	Role      Role      `db:"role"       json:"role"`
	Active    bool      `db:"active"     json:"active"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	// Password is stored in the DB but must never appear in JSON responses.
	Password string `db:"password" json:"-"`
}
