-- Migration 008: Dynamic form fields for S1-S4 stakeholders.
-- Additive only: preserves all existing columns and rows.

ALTER TABLE stakeholders ADD COLUMN target_characteristics TEXT;
ALTER TABLE stakeholders ADD COLUMN needs_or_problems TEXT;
ALTER TABLE stakeholders ADD COLUMN operation_period TEXT;
ALTER TABLE stakeholders ADD COLUMN resources_used TEXT;
ALTER TABLE stakeholders ADD COLUMN support_type TEXT;
ALTER TABLE stakeholders ADD COLUMN support_value REAL;
ALTER TABLE stakeholders ADD COLUMN support_amount_or_quantity TEXT;
ALTER TABLE stakeholders ADD COLUMN cooperation_type TEXT;
ALTER TABLE stakeholders ADD COLUMN resources_provided TEXT;
