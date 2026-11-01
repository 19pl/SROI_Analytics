-- Migration 005: "Sheet mode" — enter and calculate an SROI plan the way the Excel workbooks do.
-- All changes are additive: no existing table, column or row is modified. Existing (wizard) projects keep working
-- and keep calc_method = 'wizard'.
--
-- Reference: the two customer workbooks (eye-check project; hydrotherapy building). A sheet project is a tree of
-- stakeholder groups (S1..S4, sub-groups S1.1 ...), each with input (resource) lines and outcome lines.
-- Y0 = operating year, Y1 = projection year. SROI = total outcome (Y0+Y1) / total input (Y0+Y1).

ALTER TABLE projects ADD COLUMN calc_method TEXT NOT NULL DEFAULT 'wizard'
  CHECK (calc_method IN ('wizard','sheet'));
-- Labels for the two periods, e.g. "ปีงบประมาณ 66" / "ปีงบประมาณ 67"
ALTER TABLE projects ADD COLUMN y0_label TEXT;
ALTER TABLE projects ADD COLUMN y1_label TEXT;
-- How the adjustment % is applied once the customer enters it:
--   deduct: adjusted = value x (1 - pct)    retain: adjusted = value x pct
-- An empty adjustment % is "not assessed" (value unchanged, flagged) — never silently treated as 0 %.
ALTER TABLE projects ADD COLUMN sheet_adjustment_mode TEXT NOT NULL DEFAULT 'deduct'
  CHECK (sheet_adjustment_mode IN ('deduct','retain'));

-- Stakeholder groups and sub-groups (Excel column A..H of the Hydrotherapy workbook)
CREATE TABLE sheet_groups (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id            INTEGER REFERENCES sheet_groups(id) ON DELETE CASCADE,  -- NULL = top level (S1..S4)
  code                 TEXT,                                                   -- 'S1', 'S1.1'
  group_type           TEXT CHECK (group_type IS NULL OR group_type IN
                         ('primary_beneficiary','project_operator','project_supporter','other_agency')),
  name                 TEXT NOT NULL,
  population_raw       TEXT,                                                   -- number or formula: จำนวนประชากร
  unit                 TEXT,                                                   -- คน / ครัวเรือน / คณะ / แห่ง / หน่วยงาน
  note                 TEXT,                                                   -- หมายเหตุ
  activity             TEXT,                                                   -- กิจกรรม/ทรัพยากร
  activity_summary     TEXT,                                                   -- แนวทางการแจกแจงสรุปผลลัพธ์กิจกรรม
  actual_count_raw     TEXT,                                                   -- สรุปจำนวน STK ที่เกิดจริง (number or formula)
  actual_count_method  TEXT,                                                   -- วิธีคำนวณ/แหล่งที่มาข้อมูล
  sort_order           INTEGER NOT NULL DEFAULT 0,
  custom               TEXT NOT NULL DEFAULT '{}',                             -- values of user-defined columns
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_sheet_groups_project ON sheet_groups(project_id, sort_order);

-- Input (resource / budget) lines — "ทรัพยากร/งบประมาณ (INPUTS)"
CREATE TABLE sheet_inputs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_id    INTEGER NOT NULL REFERENCES sheet_groups(id) ON DELETE CASCADE,
  resource    TEXT NOT NULL,                  -- ระบุทรัพยากรที่ใช้
  y0_raw      TEXT,                           -- number or formula, e.g. 1300000/20
  y1_raw      TEXT,
  basis       TEXT,                           -- ระบุแนวทางการคำนวณและแหล่งที่มา
  source      TEXT,
  include_in_total INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  custom      TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_sheet_inputs_project ON sheet_inputs(project_id, group_id, sort_order);

-- Outcome lines — "ผลลัพธ์/การเปลี่ยนแปลง", "มูลค่า (Valuation)", "การจัดปรับผลลัพธ์ (Adjustment)"
CREATE TABLE sheet_outcomes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_id        INTEGER NOT NULL REFERENCES sheet_groups(id) ON DELETE CASCADE,
  dimension       TEXT CHECK (dimension IS NULL OR dimension IN ('economic','social','environmental','other')),
  beneficiary     TEXT,                       -- who within the group, e.g. ผู้รับบริการ / อาจารย์ / นิสิต
  outcome         TEXT NOT NULL,              -- ผลลัพธ์/การเปลี่ยนแปลง
  quantity_text   TEXT,                       -- ระบุจำนวน/ปริมาณของการเปลี่ยนแปลง (SIA)
  weight          REAL CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1)),  -- % น้ำหนักผลลัพธ์ (fraction)
  indicator       TEXT,                       -- ตัวชี้วัด
  valuation_method TEXT,                      -- แนวทางการคำนวณมูลค่า
  y0_raw          TEXT,                       -- number or formula
  y1_raw          TEXT,
  source          TEXT,                       -- แหล่งที่มาข้อมูล
  -- Adjustment: NULL = not assessed (waits for the customer's input)
  adj_y0          REAL CHECK (adj_y0 IS NULL OR (adj_y0 >= 0 AND adj_y0 <= 1)),
  adj_y0_reason   TEXT,
  adj_y1          REAL CHECK (adj_y1 IS NULL OR (adj_y1 >= 0 AND adj_y1 <= 1)),
  adj_y1_reason   TEXT,
  adj_source      TEXT,
  include_in_total INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  custom          TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_sheet_outcomes_project ON sheet_outcomes(project_id, group_id, sort_order);

-- User-defined extra columns ("add a new cell for a new topic"). Values live in each row's `custom` JSON, keyed by `key`.
-- A number/percent column may count toward the input or outcome total (added to that line's Y0 or Y1 value).
CREATE TABLE sheet_columns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  band          TEXT NOT NULL CHECK (band IN ('stakeholder','input','outcome')),
  key           TEXT NOT NULL,
  label         TEXT NOT NULL,
  data_type     TEXT NOT NULL DEFAULT 'text' CHECK (data_type IN ('text','number','percent','date','select')),
  options       TEXT NOT NULL DEFAULT '[]',   -- choices for data_type = 'select'
  counts_toward TEXT NOT NULL DEFAULT 'none' CHECK (counts_toward IN ('none','input','outcome')),
  count_in      TEXT NOT NULL DEFAULT 'y0' CHECK (count_in IN ('y0','y1')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (project_id, band, key)
);
CREATE INDEX idx_sheet_columns_project ON sheet_columns(project_id, band, sort_order);
