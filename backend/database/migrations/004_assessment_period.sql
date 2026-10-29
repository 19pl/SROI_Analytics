-- Migration 004: Assessment period support (6/9/12-month periods as in Hydrotherapy workbook)

-- How many months the assessment covers (6, 9, 12, or NULL for annual)
ALTER TABLE projects ADD COLUMN assessment_months INTEGER
  CHECK (assessment_months IS NULL OR assessment_months > 0);

-- Optional period label for display (e.g. 'Y0', '6 months', 'FY66')
ALTER TABLE project_costs ADD COLUMN period_label TEXT;
