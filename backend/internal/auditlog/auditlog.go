package auditlog

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

// Logger writes and reads audit log entries from the audit_logs table.
type Logger struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *Logger {
	return &Logger{db: db}
}

// Log inserts a new audit entry. Any error is silently discarded — audit logging
// must never fail a business operation.
func (l *Logger) Log(userID, action, resourceType, resourceID, ip string, details any) {
	raw, _ := json.Marshal(details)

	var uid, rid, rtype *string
	if userID != "" {
		uid = &userID
	}
	if resourceID != "" {
		rid = &resourceID
	}
	if resourceType != "" {
		rtype = &resourceType
	}

	_, _ = l.db.Exec(
		`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
		 VALUES ($1, $2, $3, $4::uuid, $5, $6::inet)`,
		uid, action, rtype, rid, json.RawMessage(raw), ip,
	)
}

// Entry is a single audit log row, joined with the user who performed the action.
type Entry struct {
	ID           string          `db:"id"            json:"id"`
	UserID       *string         `db:"user_id"       json:"user_id"`
	UserName     *string         `db:"user_name"     json:"user_name"`
	UserEmail    *string         `db:"user_email"    json:"user_email"`
	Action       string          `db:"action"        json:"action"`
	ResourceType *string         `db:"resource_type" json:"resource_type"`
	ResourceID   *string         `db:"resource_id"   json:"resource_id"`
	Details      json.RawMessage `db:"details"       json:"details"`
	IPAddress    *string         `db:"ip_address"    json:"ip_address"`
	CreatedAt    time.Time       `db:"created_at"    json:"created_at"`
}

// ListFilters controls which entries are returned by List.
type ListFilters struct {
	Action   string
	Page     int
	PageSize int
}

// List returns a paginated, newest-first slice of audit entries.
func (l *Logger) List(f ListFilters) ([]Entry, int, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 || f.PageSize > 200 {
		f.PageSize = 50
	}

	where := "WHERE 1=1"
	args := []any{}
	n := 1

	if f.Action != "" {
		where += fmt.Sprintf(" AND al.action = $%d", n)
		args = append(args, f.Action)
		n++
	}

	var total int
	if err := l.db.QueryRow(
		fmt.Sprintf(`SELECT COUNT(*) FROM audit_logs al %s`, where),
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (f.Page - 1) * f.PageSize
	args = append(args, f.PageSize, offset)

	query := fmt.Sprintf(`
		SELECT
			al.id,
			al.user_id::text,
			u.name      AS user_name,
			u.email     AS user_email,
			al.action,
			al.resource_type,
			al.resource_id::text,
			COALESCE(al.details, '{}'::jsonb) AS details,
			al.ip_address::text,
			al.created_at
		FROM audit_logs al
		LEFT JOIN users u ON u.id = al.user_id
		%s
		ORDER BY al.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, n, n+1)

	var entries []Entry
	if err := l.db.Select(&entries, query, args...); err != nil {
		return nil, 0, err
	}
	if entries == nil {
		entries = []Entry{}
	}
	return entries, total, nil
}
