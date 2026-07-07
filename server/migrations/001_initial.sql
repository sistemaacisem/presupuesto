-- 001_initial.sql — Schema inicial compatible PostgreSQL
-- Ejecutar via: node server/migrate.js

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'readonly',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS providers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    cuit        TEXT,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    city        TEXT,
    province    TEXT,
    notes       TEXT,
    rating      REAL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    aliases     TEXT DEFAULT '[]',
    category    TEXT,
    unit        TEXT DEFAULT 'unidad',
    tags        TEXT DEFAULT '[]',
    is_favorite BOOLEAN DEFAULT FALSE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  UUID REFERENCES providers(id) ON DELETE SET NULL,
    number       TEXT,
    date         DATE,
    type         TEXT NOT NULL DEFAULT 'history',
    status       TEXT NOT NULL DEFAULT 'pending',
    file_name    TEXT,
    file_path    TEXT,
    total_amount REAL DEFAULT 0,
    notes        TEXT,
    tags         TEXT DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_details (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id       UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    article_id      UUID REFERENCES articles(id) ON DELETE SET NULL,
    raw_description TEXT,
    quantity        REAL DEFAULT 1,
    unit            TEXT DEFAULT 'unidad',
    unit_price      REAL DEFAULT 0,
    total_price     REAL DEFAULT 0,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS price_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    provider_id      UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    budget_id        UUID REFERENCES budgets(id) ON DELETE SET NULL,
    budget_detail_id UUID,
    unit_price       REAL NOT NULL,
    quantity         REAL DEFAULT 1,
    date             DATE NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comparisons (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT,
    budget_id        UUID REFERENCES budgets(id) ON DELETE SET NULL,
    date             DATE NOT NULL,
    total_budget     REAL DEFAULT 0,
    total_savings    REAL DEFAULT 0,
    savings_pct      REAL DEFAULT 0,
    items_overpriced INTEGER DEFAULT 0,
    items_average    INTEGER DEFAULT 0,
    items_cheaper    INTEGER DEFAULT 0,
    results          TEXT DEFAULT '[]',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    query         TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_count  INTEGER DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type          TEXT NOT NULL DEFAULT 'overpriced',
    title         TEXT NOT NULL,
    message       TEXT NOT NULL,
    severity      TEXT NOT NULL DEFAULT 'warning',
    budget_id     UUID REFERENCES budgets(id) ON DELETE SET NULL,
    comparison_id UUID,
    is_read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    action      TEXT NOT NULL,
    user_id     TEXT,
    user_name   TEXT,
    changes     TEXT DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migrations (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date  ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ph_article  ON price_history(article_id);
CREATE INDEX IF NOT EXISTS idx_ph_provider ON price_history(provider_id);
CREATE INDEX IF NOT EXISTS idx_ph_date     ON price_history(date);
CREATE INDEX IF NOT EXISTS idx_bd_budget   ON budget_details(budget_id);
CREATE INDEX IF NOT EXISTS idx_bd_article  ON budget_details(article_id);
CREATE INDEX IF NOT EXISTS idx_b_provider  ON budgets(provider_id);
CREATE INDEX IF NOT EXISTS idx_b_date      ON budgets(date);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_date ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_bd_budget_article ON budget_details(budget_id, article_id);
CREATE INDEX IF NOT EXISTS idx_b_provider_type ON budgets(provider_id, type);
CREATE INDEX IF NOT EXISTS idx_b_type_status ON budgets(type, status);
CREATE INDEX IF NOT EXISTS idx_ph_article_provider ON price_history(article_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_budget ON comparisons(budget_id);
