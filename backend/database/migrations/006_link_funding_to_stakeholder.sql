-- Migration 006: enter each fact once.
-- Additive only: no existing table, column or row is modified.
--
-- project_costs.stakeholder_id  who provides this funding / resource (an S2/S3/S4 stakeholder, e.g. a faculty or an อบต.).
--   NULL = not linked to a stakeholder (all existing rows stay valid). Deleting a stakeholder keeps its cost rows
--   (they simply become unlinked) so no investment figure is ever lost silently.
-- stakeholders.count_unit       unit of estimated_count: คน / ครัวเรือน / คณะ / แห่ง ... (Excel column "หน่วย").
ALTER TABLE project_costs ADD COLUMN stakeholder_id INTEGER REFERENCES stakeholders(id) ON DELETE SET NULL;
CREATE INDEX idx_costs_stakeholder ON project_costs(stakeholder_id);
ALTER TABLE stakeholders ADD COLUMN count_unit TEXT;
