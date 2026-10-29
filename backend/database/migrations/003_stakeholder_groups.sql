-- Migration 003: Stakeholder classification groups (maps to Excel S1/S2/S3/S4)

ALTER TABLE stakeholders ADD COLUMN stakeholder_group TEXT
  CHECK (stakeholder_group IS NULL OR stakeholder_group IN (
    'primary_beneficiary',
    'project_operator',
    'project_supporter',
    'other_agency'
  ));

-- Human-readable sub-group code (e.g. 'S1', 'S1.1', 'S2.3')
ALTER TABLE stakeholders ADD COLUMN group_code TEXT;
