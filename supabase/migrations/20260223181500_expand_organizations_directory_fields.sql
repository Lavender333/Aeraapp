-- Expand organizations table to store directory fields used in the app.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS replenishment_provider TEXT,
  ADD COLUMN IF NOT EXISTS replenishment_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS replenishment_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS registered_population INTEGER;
