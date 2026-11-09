-- Migration 009: Line items for project costs (Step 1).
-- A cost can be built from several lines of unit_price x quantity (+ unit); amount = sum of lines.
-- Stored as a JSON array: [{"unit_price":100,"quantity":10,"unit":"sheet"}, ...]
-- Additive only: existing rows keep line_items NULL and continue to work (manual / single quantity mode).

ALTER TABLE project_costs ADD COLUMN line_items TEXT;