-- Hotfix: log_activity trigger fails on tables without org_id field
-- Error seen: record "NEW" has no field "org_id"

CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_entity_id UUID;
  v_user_id UUID;
  v_row JSONB;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_row := to_jsonb(OLD);
  ELSE
    v_entity_id := NEW.id;
    v_row := to_jsonb(NEW);
  END IF;

  -- Some tables don't have org_id.
  IF v_row ? 'org_id' THEN
    BEGIN
      v_org_id := NULLIF(v_row->>'org_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_org_id := NULL;
    END;
  ELSIF v_row ? 'organization_id' THEN
    BEGIN
      v_org_id := NULLIF(v_row->>'organization_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_org_id := NULL;
    END;
  ELSE
    v_org_id := NULL;
  END IF;

  INSERT INTO activity_log (org_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_org_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_build_object('table', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
