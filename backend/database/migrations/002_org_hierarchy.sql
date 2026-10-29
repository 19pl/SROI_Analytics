-- Migration 002: Faculty and Department organizational hierarchy
-- All changes are additive. No existing tables or data are modified.

CREATE TABLE IF NOT EXISTS faculties (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_faculties_org ON faculties(organization_id);

CREATE TABLE IF NOT EXISTS departments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  faculty_id INTEGER NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_departments_faculty ON departments(faculty_id);

-- Extend projects with optional ownership columns
-- Exactly one of (faculty_id, department_id) may be non-null at a time.
-- Both null means: project is owned directly by the organization (legacy behaviour).
ALTER TABLE projects ADD COLUMN faculty_id    INTEGER REFERENCES faculties(id)   ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_faculty    ON projects(faculty_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id, deleted_at);
