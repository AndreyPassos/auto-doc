CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('operator', 'manager', 'admin');
CREATE TYPE doc_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE doc_type AS ENUM ('pdf', 'png');

CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    name       VARCHAR(255) NOT NULL,
    role       user_role NOT NULL DEFAULT 'operator',
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename VARCHAR(500) NOT NULL,
    stored_path       VARCHAR(500) NOT NULL,
    file_type         doc_type NOT NULL,
    file_size         BIGINT NOT NULL,
    status            doc_status NOT NULL DEFAULT 'pending',
    extracted_text    TEXT,
    patterns          JSONB,
    xml_enriched      BOOLEAN NOT NULL DEFAULT FALSE,
    xml_data          JSONB,
    xml_enriched_at   TIMESTAMPTZ,
    error_message     TEXT,
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_status      ON documents(status);
CREATE INDEX idx_documents_created_at  ON documents(created_at);
CREATE INDEX idx_documents_created_by  ON documents(created_by);
CREATE INDEX idx_documents_xml_enriched ON documents(xml_enriched);

CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id),
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id   UUID,
    details       JSONB,
    ip_address    INET,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id   ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
