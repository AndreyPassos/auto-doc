package report

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

// SummaryReport holds aggregated document statistics.
type SummaryReport struct {
	Total    int            `json:"total"`
	ByStatus map[string]int `json:"by_status"`
	ByType   map[string]int `json:"by_type"`
	ByDay    []DayCount     `json:"by_day"`
}

// DayCount holds the document count for a single day.
type DayCount struct {
	Date  string `json:"date" db:"day"`
	Count int    `json:"count" db:"count"`
}

// DocumentRow is a slimmed-down projection used in report listings.
type DocumentRow struct {
	ID               string    `json:"id" db:"id"`
	OriginalFilename string    `json:"original_filename" db:"original_filename"`
	FileType         string    `json:"file_type" db:"file_type"`
	Status           string    `json:"status" db:"status"`
	XMLEnriched      bool      `json:"xml_enriched" db:"xml_enriched"`
	FileSize         int64     `json:"file_size" db:"file_size"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

// ListFilters holds optional filter criteria for the document report listing.
type ListFilters struct {
	Status   string
	FileType string
	From     *time.Time
	To       *time.Time
	Enriched *bool
	Page     int
	PageSize int
}

// Service provides reporting capabilities over the documents table.
type Service struct {
	db *sqlx.DB
}

// NewService creates a new report Service.
func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

// Summary returns aggregate document statistics scoped to the given date range.
// All counts (total, by_status, by_type, by_day) reflect the same window.
// When from/to are nil, by_day defaults to the last 30 days.
func (s *Service) Summary(from, to *time.Time) (*SummaryReport, error) {
	// Build shared WHERE clause and args used by all sub-queries.
	filterArgs := []interface{}{}
	baseWhere := "WHERE 1=1"
	i := 1
	if from != nil {
		baseWhere += fmt.Sprintf(" AND created_at >= $%d", i)
		filterArgs = append(filterArgs, from)
		i++
	}
	if to != nil {
		baseWhere += fmt.Sprintf(" AND created_at <= $%d", i)
		filterArgs = append(filterArgs, to)
		i++
	}
	// When no range is given, scope by_day (and counts) to last 30 days.
	if from == nil && to == nil {
		baseWhere += " AND created_at >= NOW() - INTERVAL '30 days'"
	}
	_ = i

	// --- total count ---
	var total int
	if err := s.db.QueryRow(
		fmt.Sprintf(`SELECT COUNT(*) FROM documents %s`, baseWhere),
		filterArgs...,
	).Scan(&total); err != nil {
		return nil, fmt.Errorf("summary total: %w", err)
	}

	// --- by_status ---
	type kv struct {
		Key   string `db:"status"`
		Value int    `db:"cnt"`
	}
	var statusRows []kv
	if err := s.db.Select(&statusRows,
		fmt.Sprintf(`SELECT status, COUNT(*) AS cnt FROM documents %s GROUP BY status`, baseWhere),
		filterArgs...,
	); err != nil {
		return nil, fmt.Errorf("summary by_status: %w", err)
	}
	byStatus := make(map[string]int, len(statusRows))
	for _, r := range statusRows {
		byStatus[r.Key] = r.Value
	}

	// --- by_type ---
	var typeRows []struct {
		Key   string `db:"file_type"`
		Value int    `db:"cnt"`
	}
	if err := s.db.Select(&typeRows,
		fmt.Sprintf(`SELECT file_type, COUNT(*) AS cnt FROM documents %s GROUP BY file_type`, baseWhere),
		filterArgs...,
	); err != nil {
		return nil, fmt.Errorf("summary by_type: %w", err)
	}
	byType := make(map[string]int, len(typeRows))
	for _, r := range typeRows {
		byType[r.Key] = r.Value
	}

	// --- by_day (same window as above) ---
	byDayQuery := fmt.Sprintf(`
		SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
		       COUNT(*) AS count
		FROM documents %s
		GROUP BY day
		ORDER BY day ASC`, baseWhere)

	var byDay []DayCount
	if err := s.db.Select(&byDay, byDayQuery, filterArgs...); err != nil {
		return nil, fmt.Errorf("summary by_day: %w", err)
	}
	if byDay == nil {
		byDay = []DayCount{}
	}

	return &SummaryReport{
		Total:    total,
		ByStatus: byStatus,
		ByType:   byType,
		ByDay:    byDay,
	}, nil
}

// List returns a paginated, filtered slice of DocumentRow and the total count.
func (s *Service) List(f ListFilters) ([]DocumentRow, int, error) {
	// Clamp page size.
	if f.PageSize < 1 {
		f.PageSize = 20
	}
	if f.PageSize > 100 {
		f.PageSize = 100
	}
	if f.Page < 1 {
		f.Page = 1
	}

	args := []interface{}{}
	conds := []string{}
	i := 1

	if f.Status != "" {
		conds = append(conds, fmt.Sprintf("status = $%d", i))
		args = append(args, f.Status)
		i++
	}
	if f.FileType != "" {
		conds = append(conds, fmt.Sprintf("file_type = $%d", i))
		args = append(args, f.FileType)
		i++
	}
	if f.From != nil {
		conds = append(conds, fmt.Sprintf("created_at >= $%d", i))
		args = append(args, f.From)
		i++
	}
	if f.To != nil {
		conds = append(conds, fmt.Sprintf("created_at <= $%d", i))
		args = append(args, f.To)
		i++
	}
	if f.Enriched != nil {
		conds = append(conds, fmt.Sprintf("xml_enriched = $%d", i))
		args = append(args, *f.Enriched)
		i++
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM documents %s", where)
	if err := s.db.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("report list count: %w", err)
	}

	offset := (f.Page - 1) * f.PageSize
	dataQ := fmt.Sprintf(`
		SELECT id, original_filename, file_type, status, xml_enriched, file_size, created_at
		FROM documents %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, where, i, i+1)
	args = append(args, f.PageSize, offset)

	var rows []DocumentRow
	if err := s.db.Select(&rows, dataQ, args...); err != nil {
		return nil, 0, fmt.Errorf("report list query: %w", err)
	}
	if rows == nil {
		rows = []DocumentRow{}
	}

	return rows, total, nil
}

// ExportCSV returns CSV-encoded document data for the optional filter criteria.
func (s *Service) ExportCSV(from, to *time.Time, status string) ([]byte, error) {
	args := []interface{}{}
	conds := []string{}
	i := 1

	if status != "" {
		conds = append(conds, fmt.Sprintf("status = $%d", i))
		args = append(args, status)
		i++
	}
	if from != nil {
		conds = append(conds, fmt.Sprintf("created_at >= $%d", i))
		args = append(args, from)
		i++
	}
	if to != nil {
		conds = append(conds, fmt.Sprintf("created_at <= $%d", i))
		args = append(args, to)
		i++
	}

	_ = i // consumed; kept for pattern consistency

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT id, original_filename, file_type, status, xml_enriched, file_size, created_at
		FROM documents %s
		ORDER BY created_at DESC`, where)

	var rows []DocumentRow
	if err := s.db.Select(&rows, query, args...); err != nil {
		return nil, fmt.Errorf("export csv query: %w", err)
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Header row.
	if err := w.Write([]string{"id", "filename", "type", "status", "xml_enriched", "size_bytes", "created_at"}); err != nil {
		return nil, fmt.Errorf("csv write header: %w", err)
	}

	for _, r := range rows {
		record := []string{
			r.ID,
			r.OriginalFilename,
			r.FileType,
			r.Status,
			strconv.FormatBool(r.XMLEnriched),
			strconv.FormatInt(r.FileSize, 10),
			r.CreatedAt.UTC().Format(time.RFC3339),
		}
		if err := w.Write(record); err != nil {
			return nil, fmt.Errorf("csv write record: %w", err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, fmt.Errorf("csv flush: %w", err)
	}

	return buf.Bytes(), nil
}
