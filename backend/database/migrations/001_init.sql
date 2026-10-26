-- ImpactValue SROI backend — initial schema (SQLite). All timestamps are UTC ISO-8601.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE organizations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE memberships (
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE api_tokens (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_login_attempts ON login_attempts(email, attempted_at);

CREATE TABLE projects (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id        INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  organization_name      TEXT,                 -- the organisation/institution running the project
  description            TEXT,
  category               TEXT,
  country                TEXT,
  start_date             TEXT,
  end_date               TEXT,
  evaluation_type        TEXT NOT NULL DEFAULT 'forecast' CHECK (evaluation_type IN ('forecast','evaluative')),
  currency               TEXT NOT NULL,
  price_basis            TEXT,                 -- e.g. "constant 2026 prices"
  analysis_period_years  INTEGER CHECK (analysis_period_years IS NULL OR analysis_period_years BETWEEN 1 AND 100),
  discount_rate          REAL    CHECK (discount_rate IS NULL OR (discount_rate >= 0 AND discount_rate <= 1)),
  discount_rate_basis    TEXT    CHECK (discount_rate_basis IS NULL OR discount_rate_basis IN ('real','nominal')),
  discount_rate_source   TEXT,
  discount_base_year     INTEGER NOT NULL DEFAULT 0 CHECK (discount_base_year >= 0),
  investment_basis       TEXT    CHECK (investment_basis IS NULL OR investment_basis IN ('nominal','present_value')),
  include_in_kind        INTEGER NOT NULL DEFAULT 1,
  wizard_step            INTEGER NOT NULL DEFAULT 1 CHECK (wizard_step BETWEEN 1 AND 6),
  status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','archived')),
  created_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  deleted_at             TEXT
);
CREATE INDEX idx_projects_org ON projects(organization_id, deleted_at);

CREATE TABLE project_costs (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id              INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category                TEXT NOT NULL CHECK (category IN ('capex','opex','delivery','administration','in_kind','other')),
  description             TEXT NOT NULL,
  amount                  REAL NOT NULL CHECK (amount >= 0),
  currency                TEXT NOT NULL,
  exchange_rate           REAL NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),  -- 1 unit of `currency` in project currency
  year                    INTEGER NOT NULL CHECK (year >= 0),                 -- 0 = start of project
  incurred_on             TEXT,
  is_cash                 INTEGER NOT NULL DEFAULT 1,
  include_in_calculation  INTEGER NOT NULL DEFAULT 1,
  evidence_source         TEXT,
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_costs_project ON project_costs(project_id);

CREATE TABLE stakeholders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  role_in_project   TEXT,
  estimated_count   INTEGER CHECK (estimated_count IS NULL OR estimated_count >= 0),
  expected_positive TEXT,
  expected_negative TEXT,
  evidence_source   TEXT,
  overlap_notes     TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_stakeholders_project ON stakeholders(project_id);

CREATE TABLE financial_proxies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global library entry
  name            TEXT NOT NULL,
  definition      TEXT,
  category        TEXT NOT NULL,
  unit            TEXT NOT NULL,
  currency        TEXT NOT NULL,
  value           REAL NOT NULL,
  geography       TEXT,
  reference_year  INTEGER,
  source          TEXT NOT NULL,
  source_url      TEXT,
  limitations     TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_proxies_org ON financial_proxies(organization_id, category);

CREATE TABLE outcomes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stakeholder_id    INTEGER NOT NULL REFERENCES stakeholders(id) ON DELETE RESTRICT,
  proxy_id          INTEGER REFERENCES financial_proxies(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  activity          TEXT,                 -- what the project does
  output_description TEXT,                -- what it produces (e.g. 500 tutoring hours)
  indicator         TEXT,
  baseline          TEXT,
  observed_result   TEXT,
  quantity          REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  proxy_value       REAL CHECK (proxy_value IS NULL OR proxy_value >= 0),  -- NULL = not monetised
  proxy_unit        TEXT,
  proxy_source      TEXT,
  proxy_rationale   TEXT,
  polarity          TEXT NOT NULL DEFAULT 'positive' CHECK (polarity IN ('positive','negative')),
  projection_model  TEXT NOT NULL DEFAULT 'cohort' CHECK (projection_model IN ('cohort','recurring_cohorts','independent')),
  start_year        INTEGER NOT NULL DEFAULT 1 CHECK (start_year >= 1),
  duration_years    INTEGER NOT NULL DEFAULT 1 CHECK (duration_years >= 1),
  entry_years       INTEGER CHECK (entry_years IS NULL OR entry_years >= 1),
  evidence_quality  TEXT NOT NULL CHECK (evidence_quality IN ('measured','external','estimated','assumed')),
  overlap_group     TEXT,
  include_in_total  INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_outcomes_project ON outcomes(project_id);
CREATE INDEX idx_outcomes_stakeholder ON outcomes(stakeholder_id);

-- NULL percentages mean "not assessed" (never pre-populated with universal defaults).
CREATE TABLE impact_adjustments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  outcome_id    INTEGER NOT NULL UNIQUE REFERENCES outcomes(id) ON DELETE CASCADE,
  deadweight    REAL CHECK (deadweight   IS NULL OR (deadweight   BETWEEN 0 AND 1)),
  attribution   REAL CHECK (attribution  IS NULL OR (attribution  BETWEEN 0 AND 1)),
  displacement  REAL CHECK (displacement IS NULL OR (displacement BETWEEN 0 AND 1)),
  drop_off      REAL CHECK (drop_off     IS NULL OR (drop_off     BETWEEN 0 AND 1)),
  justification TEXT,
  source        TEXT,
  updated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE outcome_year_projections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  outcome_id INTEGER NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL CHECK (year >= 1),
  quantity   REAL CHECK (quantity IS NULL OR quantity >= 0),
  drop_off   REAL CHECK (drop_off IS NULL OR (drop_off BETWEEN 0 AND 1)),
  note       TEXT,
  UNIQUE (outcome_id, year)
);

CREATE TABLE evidence_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project','cost','stakeholder','outcome','adjustment')),
  entity_id   INTEGER,
  kind        TEXT NOT NULL CHECK (kind IN ('url','document','citation','survey','internal','file')),
  title       TEXT NOT NULL,
  reference   TEXT,
  notes       TEXT,
  file_path   TEXT,
  file_name   TEXT,
  mime_type   TEXT,
  size_bytes  INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_evidence_project ON evidence_sources(project_id, entity_type, entity_id);

CREATE TABLE scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('conservative','base','optimistic','custom')),
  description TEXT,
  is_base     INTEGER NOT NULL DEFAULT 0,
  assumptions TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_scenarios_project ON scenarios(project_id);

CREATE TABLE calculation_runs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scenario_id         INTEGER REFERENCES scenarios(id) ON DELETE SET NULL,
  scenario_name       TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  input_hash          TEXT NOT NULL,
  sroi_ratio          REAL,            -- headline numbers duplicated for cheap listing/comparison
  present_value       REAL NOT NULL,
  investment          REAL NOT NULL,
  net_social_value    REAL NOT NULL,
  snapshot            TEXT NOT NULL,   -- full validated input used by the engine
  result              TEXT NOT NULL,   -- engine output
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_runs_project ON calculation_runs(project_id, created_at);

CREATE TABLE reports (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  calculation_run_id INTEGER NOT NULL REFERENCES calculation_runs(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('executive','detailed')),
  title              TEXT NOT NULL,
  payload            TEXT NOT NULL,   -- immutable document generated from the run
  share_token_hash   TEXT UNIQUE,
  share_expires_at   TEXT,
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_reports_project ON reports(project_id);

CREATE TABLE audit_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER,
  project_id      INTEGER,
  user_id         INTEGER,
  user_name       TEXT,
  entity_type     TEXT NOT NULL,
  entity_id       INTEGER,
  action          TEXT NOT NULL,
  old_values      TEXT,
  new_values      TEXT,
  reason          TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_audit_project ON audit_events(project_id, created_at);
