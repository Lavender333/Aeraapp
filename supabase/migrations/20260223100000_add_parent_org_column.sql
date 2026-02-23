-- Add hierarchical support for organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id ON organizations(parent_org_id);
