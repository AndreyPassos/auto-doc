package document

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(doc *Document) error {
	query := `
		INSERT INTO documents (original_filename, stored_path, file_type, file_size, created_by)
		VALUES (:original_filename, :stored_path, :file_type, :file_size, :created_by)
		RETURNING id, status, created_at, updated_at`
	rows, err := r.db.NamedQuery(query, doc)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&doc.ID, &doc.Status, &doc.CreatedAt, &doc.UpdatedAt)
	}
	return nil
}

func (r *Repository) FindByID(id string) (*Document, error) {
	var doc Document
	err := r.db.Get(&doc, `SELECT * FROM documents WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (r *Repository) UpdateProcessed(id string, text string, patterns Patterns) error {
	raw, err := json.Marshal(patterns)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(`
		UPDATE documents SET
			status = 'completed',
			extracted_text = $2,
			patterns = $3,
			updated_at = NOW()
		WHERE id = $1`, id, text, json.RawMessage(raw))
	return err
}

func (r *Repository) UpdateFailed(id, errMsg string) error {
	_, err := r.db.Exec(`
		UPDATE documents SET status = 'failed', error_message = $2, updated_at = NOW()
		WHERE id = $1`, id, errMsg)
	return err
}

func (r *Repository) UpdateStatus(id string, status Status) error {
	_, err := r.db.Exec(`UPDATE documents SET status = $2, updated_at = NOW() WHERE id = $1`, id, status)
	return err
}

func (r *Repository) Enrich(id string, xmlData json.RawMessage) error {
	_, err := r.db.Exec(`
		UPDATE documents SET
			xml_enriched = true,
			xml_data = $2,
			xml_enriched_at = NOW(),
			updated_at = NOW()
		WHERE id = $1`, id, xmlData)
	return err
}

func (r *Repository) Delete(id string) error {
	res, err := r.db.Exec(`DELETE FROM documents WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repository) List(f ListFilters) ([]Document, int, error) {
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
		args = append(args, f.Enriched)
		i++
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	if err := r.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM documents %s", where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 {
		f.PageSize = 20
	}
	offset := (f.Page - 1) * f.PageSize

	query := fmt.Sprintf(`
		SELECT * FROM documents %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, where, i, i+1)
	args = append(args, f.PageSize, offset)

	var docs []Document
	if err := r.db.Select(&docs, query, args...); err != nil {
		return nil, 0, err
	}
	return docs, total, nil
}
