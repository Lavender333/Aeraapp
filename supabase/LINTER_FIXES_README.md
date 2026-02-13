# Database Linter Fixes

This document explains the Supabase database linter warnings/errors and how to fix them.

## Issues Addressed

### 1. ✅ RLS Disabled on `spatial_ref_sys` (ERROR)
**Status:** Fixed via SQL  
**File:** `fix-linter-warnings.sql`

The PostGIS `spatial_ref_sys` table is a reference table that didn't have Row Level Security enabled. We've enabled RLS and created a permissive read policy since it contains no sensitive user data.

### 2. ✅ Function Search Path Mutable (WARN)
**Status:** Fixed via SQL  
**File:** `fix-linter-warnings.sql` and `state-ready-schema.sql`

Five functions were vulnerable to search path hijacking attacks:
- `calculate_vulnerability_risk`
- `set_vulnerability_risk_score`
- `compute_drift`
- `drift_status_from_value`
- `recommended_kit_duration_from_risk`

**Fix:** Added `SET search_path = public` to all function definitions.

### 3. ⚠️ PostGIS Extension in Public Schema (WARN)
**Status:** Documented - No action required  
**Rationale:** Moving PostGIS to another schema would require updating all geometry/geography column references throughout the database. This is acceptable for system extensions like PostGIS.

### 4. ⚠️ Auth Leaked Password Protection Disabled (WARN)
**Status:** Requires Supabase Dashboard configuration  
**Action Required:** Manual setup

## How to Apply Fixes

### Step 1: Run SQL Migration
Execute the SQL fixes in your Supabase SQL Editor:

```bash
# In Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Create new query
# 3. Paste contents of: supabase/fix-linter-warnings.sql
# 4. Click "Run"
```

Or via CLI:
```bash
supabase db execute -f supabase/fix-linter-warnings.sql
```

### Step 2: Enable Leaked Password Protection

**Option A: Supabase Dashboard**
1. Navigate to: **Authentication > Policies**
2. Click on **Password Requirements**
3. Enable: **"Check for breached passwords (HaveIBeenPwned)"**
4. Click **Save**

**Option B: Management API**
```bash
curl -X PATCH https://api.supabase.com/v1/projects/{project_ref}/config/auth \
  -H "Authorization: Bearer {service_role_key}" \
  -H "Content-Type: application/json" \
  -d '{"SECURITY_BREACH_PROTECTION_ENABLED": true}'
```

**Option C: Local Development (.env)**
Add to your local `.env`:
```bash
GOTRUE_SECURITY_BREACH_PROTECTION_ENABLED=true
```

## Verification

After applying fixes, re-run the database linter:

```bash
# In Supabase Dashboard
# 1. Go to Database > Linter
# 2. Click "Refresh"
# 3. Verify warnings are resolved
```

Expected results:
- ✅ RLS Disabled: **0 errors**
- ✅ Function Search Path: **0 warnings** for the 5 functions
- ✅ Extension in Public: **Accepted** (documented exception)
- ✅ Leaked Password Protection: **0 warnings** (after Dashboard config)

## Security Benefits

### RLS on System Tables
Prevents unauthorized access even to reference tables, following defense-in-depth principles.

### Function Search Path Protection
Prevents attackers from hijacking function behavior by manipulating the schema search path.

### Leaked Password Protection
Prevents users from setting passwords that have been compromised in data breaches, reducing account takeover risk.

## References

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Function Security](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Password Security](https://supabase.com/docs/guides/auth/password-security)
- [PostGIS Schema Management](https://postgis.net/docs/manual-3.3/using_postgis_dbmanagement.html)

## Next Steps

1. ✅ Run `fix-linter-warnings.sql` in Supabase SQL Editor
2. ⚙️ Enable leaked password protection in Dashboard
3. ✅ Re-run linter to verify all fixes
4. 📝 Commit changes to version control
5. 🚀 Deploy to production

---

**Date Created:** February 13, 2026  
**Last Updated:** February 13, 2026
