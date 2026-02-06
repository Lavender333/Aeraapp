-- =====================================================
-- AERA Emergency Response Application
-- Supabase PostgreSQL Schema
-- Phase 2: Database Migration from MongoDB to PostgreSQL
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles
CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'CONTRACTOR',
  'LOCAL_AUTHORITY',
  'FIRST_RESPONDER',
  'GENERAL_USER',
  'INSTITUTION_ADMIN'
);

-- Member status
CREATE TYPE member_status AS ENUM (
  'SAFE',
  'DANGER',
  'UNKNOWN'
);

-- Request status (replenishment)
CREATE TYPE request_status AS ENUM (
  'PENDING',
  'APPROVED',
  'FULFILLED',
  'STOCKED'
);

-- Help request status
CREATE TYPE help_status AS ENUM (
  'PENDING',
  'RECEIVED',
  'DISPATCHED',
  'RESOLVED'
);

-- Help request priority
CREATE TYPE help_priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Organizations (Churches, NGOs, Community Centers)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'CH-9921'
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100), -- 'CHURCH', 'NGO', 'COMMUNITY_CENTER'
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on org_code for fast lookups
CREATE INDEX idx_organizations_org_code ON organizations(org_code);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  full_name VARCHAR(255),
  role user_role DEFAULT 'GENERAL_USER',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_phone ON profiles(phone);

-- Inventory (one per organization)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  water INTEGER DEFAULT 0 CHECK (water >= 0),
  food INTEGER DEFAULT 0 CHECK (food >= 0),
  blankets INTEGER DEFAULT 0 CHECK (blankets >= 0),
  medical_kits INTEGER DEFAULT 0 CHECK (medical_kits >= 0),
  last_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_org_id ON inventory(org_id);

-- Replenishment Requests
CREATE TABLE replenishment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_name VARCHAR(255), -- Denormalized for convenience
  item VARCHAR(100) NOT NULL, -- 'Water', 'Food', 'Blankets', 'Medical Kits'
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status request_status DEFAULT 'PENDING',
  provider VARCHAR(255),
  delivered_quantity INTEGER DEFAULT 0 CHECK (delivered_quantity >= 0),
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  fulfilled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  signature TEXT,
  signed_at TIMESTAMPTZ,
  received_signature TEXT,
  received_at TIMESTAMPTZ,
  stocked BOOLEAN DEFAULT false,
  stocked_at TIMESTAMPTZ,
  stocked_quantity INTEGER DEFAULT 0,
  org_confirmed BOOLEAN DEFAULT false,
  org_confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_replenishment_org_id ON replenishment_requests(org_id);
CREATE INDEX idx_replenishment_status ON replenishment_requests(status);
CREATE INDEX idx_replenishment_created ON replenishment_requests(created_at DESC);

-- Member Status (safety check-ins)
CREATE TABLE member_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id VARCHAR(100) NOT NULL, -- External member identifier
  name VARCHAR(255) NOT NULL,
  status member_status DEFAULT 'UNKNOWN',
  last_check_in TIMESTAMPTZ DEFAULT NOW(),
  checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, member_id)
);

CREATE INDEX idx_member_status_org_id ON member_statuses(org_id);
CREATE INDEX idx_member_status_status ON member_statuses(status);
CREATE INDEX idx_member_status_unique ON member_statuses(org_id, member_id);

-- Broadcasts (organization-wide announcements)
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  history JSONB DEFAULT '[]',
  posted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_org_id ON broadcasts(org_id);

-- Help Requests (SOS/Emergency calls)
CREATE TABLE help_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status help_status DEFAULT 'RECEIVED',
  priority help_priority DEFAULT 'LOW',
  data JSONB DEFAULT '{}', -- Flexible field for form data
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_help_requests_org_id ON help_requests(org_id);
CREATE INDEX idx_help_requests_user_id ON help_requests(user_id);
CREATE INDEX idx_help_requests_status ON help_requests(status);
CREATE INDEX idx_help_requests_priority ON help_requests(priority);
CREATE INDEX idx_help_requests_created ON help_requests(created_at DESC);

-- Members (organization member directory)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status member_status DEFAULT 'UNKNOWN',
  location TEXT,
  last_update TIMESTAMPTZ,
  needs TEXT[], -- Array of needs
  phone VARCHAR(50),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  emergency_contact_relation VARCHAR(100),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_members_org_id ON members(org_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_created ON members(created_at DESC);

-- =====================================================
-- AUDIT & ACTIVITY LOGGING
-- =====================================================

-- Activity log for audit trail
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
  entity_type VARCHAR(100), -- 'inventory', 'member', 'help_request', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_org_id ON activity_log(org_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_replenishment_requests_updated_at BEFORE UPDATE ON replenishment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_statuses_updated_at BEFORE UPDATE ON member_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_help_requests_updated_at BEFORE UPDATE ON help_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create inventory for new organizations
CREATE OR REPLACE FUNCTION create_default_inventory()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (org_id, water, food, blankets, medical_kits)
  VALUES (NEW.id, 0, 0, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_org_inventory AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_inventory();

-- Function to auto-create broadcast entry for new organizations
CREATE OR REPLACE FUNCTION create_default_broadcast()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO broadcasts (org_id, message)
  VALUES (NEW.id, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_org_broadcast AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_broadcast();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Organization summary view
CREATE VIEW organization_summary AS
SELECT 
  o.id,
  o.org_code,
  o.name,
  o.type,
  i.water,
  i.food,
  i.blankets,
  i.medical_kits,
  COUNT(DISTINCT p.id) as member_count,
  COUNT(DISTINCT CASE WHEN hr.status IN ('PENDING', 'RECEIVED') THEN hr.id END) as active_help_requests,
  COUNT(DISTINCT CASE WHEN rr.status = 'PENDING' THEN rr.id END) as pending_requests
FROM organizations o
LEFT JOIN inventory i ON o.id = i.org_id
LEFT JOIN profiles p ON o.id = p.org_id AND p.is_active = true
LEFT JOIN help_requests hr ON o.id = hr.org_id
LEFT JOIN replenishment_requests rr ON o.id = rr.org_id
WHERE o.is_active = true
GROUP BY o.id, o.org_code, o.name, o.type, i.water, i.food, i.blankets, i.medical_kits;

-- Member safety summary view
CREATE VIEW member_safety_summary AS
SELECT 
  org_id,
  COUNT(*) as total_members,
  COUNT(CASE WHEN status = 'SAFE' THEN 1 END) as safe_count,
  COUNT(CASE WHEN status = 'DANGER' THEN 1 END) as danger_count,
  COUNT(CASE WHEN status = 'UNKNOWN' THEN 1 END) as unknown_count
FROM member_statuses
GROUP BY org_id;

-- =====================================================
-- SEED DATA (Optional - for development)
-- =====================================================

-- Insert sample organization
INSERT INTO organizations (org_code, name, type, address, city, state, phone, email, contact_person)
VALUES 
  ('CH-9921', 'Grace Community Church', 'CHURCH', '123 Main St', 'Springfield', 'IL', '555-0100', 'info@gracechurch.org', 'Pastor John'),
  ('NG-1001', 'Red Cross Local Chapter', 'NGO', '456 Oak Ave', 'Springfield', 'IL', '555-0200', 'contact@redcross.local', 'Sarah Connor');

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE organizations IS 'Organizations (churches, NGOs, community centers) that coordinate emergency response';
COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users with org assignment and roles';
COMMENT ON TABLE inventory IS 'Current inventory levels for each organization';
COMMENT ON TABLE replenishment_requests IS 'Requests for supply replenishment from organizations';
COMMENT ON TABLE member_statuses IS 'Safety status check-ins for organization members';
COMMENT ON TABLE broadcasts IS 'Organization-wide announcements and alerts';
COMMENT ON TABLE help_requests IS 'Emergency SOS and help requests from users';
COMMENT ON TABLE members IS 'Organization member directory with contact information';
COMMENT ON TABLE activity_log IS 'Audit trail for all significant actions in the system';

-- =====================================================
-- GRANT PERMISSIONS (adjust based on Supabase setup)
-- =====================================================

-- Grant necessary permissions to authenticated users
-- (RLS policies will further restrict access)

-- Note: Supabase automatically handles most permissions
-- Additional grants can be added here if needed for specific roles
