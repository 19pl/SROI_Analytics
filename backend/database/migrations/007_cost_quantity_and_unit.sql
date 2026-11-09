-- Migration 007: Quantity, Unit, and Unit Price for Project Costs (Step 1).
-- Allows items to be specified either manually (manual mode) or computed from quantity * unit_price (quantity mode).
-- Additive only: preserves existing rows (calculation_mode defaults to 'manual', new columns are nullable).

ALTER TABLE project_costs ADD COLUMN calculation_mode TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE project_costs ADD COLUMN quantity REAL;
ALTER TABLE project_costs ADD COLUMN unit TEXT;
ALTER TABLE project_costs ADD COLUMN unit_price REAL;
