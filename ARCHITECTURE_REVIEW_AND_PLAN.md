# ARCHITECTURE REVIEW & SIMPLIFIED STRUCTURE PLAN

**Status**: Review Complete | Ready for Implementation
**Date**: February 13, 2026

---

## 🔴 CURRENT STATE ANALYSIS

### What Works
- **User authentication** (Supabase) ✅
- **Household member tracking** (HouseholdManager component) ✅
- **Inventory system** (for orgs) ✅
- **Organization framework** (working but complex) ✅

### What's Broken / Over-Complex
- **Two member systems** coexist (HouseholdMember vs Organization Member)
- **Profile bloat**: UserProfile has fields for everything (identity, household, health, org-specific, vulnerabilities)
- **No household isolation**: User data mixed across profiles, vitals, vulnerability_profiles, household_members tables
- **Household codes don't exist**: No code generation or invitation system
- **Registration chaos**: REGISTRATION → ACCOUNT_SETUP → ORG_REGISTRATION (3 steps, unclear why)
- **Data duplication**: Same info stored in multiple tables (name, address, phone repeated)
- **Org-first mindset**: System assumes everyone joins an organization
- **Household vs Community confusion**: Some tables use "household" (private), others use "members" (org-scoped)

---

## 📊 CURRENT DATA STRUCTURE

### Tables/Collections
```
auth.users
  └─ profiles (identity + org_id mixed in)
  
household_members (local, per-user)
  └─ profile_id, name, age, special_needs

members (ORG-scoped, separate concept)
  └─ org_id, name, status, location, needs

vitals (health info, tied to profile)
  └─ profile_id, household_size, medical_needs, meds deps

vulnerability_profiles (assessment, tied to profile)
  └─ profile_id, organization_id, risk flags

organizations (orgs only)
  └─ org_code, name, type, verified

kit_recommendations (preparedness, but org-facing)
  └─ profile_id, organization_id, items
```

### The Problem
- `profile_id` + `org_id` = user appears twice (once as individual, once as member)
- Data scattered across `profiles`, `vitals`, `vulnerability_profiles`, `household_members`
- No clear separation: identity vs home vs readiness

---

## ✅ NEW SIMPLIFIED STRUCTURE

### 3 Clean Buckets

#### 1️⃣ IDENTITY (User Account)
```
auth.users
  email
  password_hash
  created_at
  
profiles
  id (from auth.users)
  full_name
  email
  phone
  address (Google verified)
  language_preference
  created_at
  updated_at
```

**That's it.** No household info, no org info.

---

#### 2️⃣ HOME (Household Structure)
```
households
  id (UUID)
  owner_id (profile_id - the person who signed up)
  household_code (unique, auto-generated, 6-char alphanumeric)
  name ("Your Home")
  created_at
  updated_at

household_members
  id (UUID)
  household_id
  name
  age_group ("Adult" | "Teen" | "Child" | "Senior")
  mobility_flag (boolean - needs assistance)
  medical_flag (boolean - has medical condition)
  requires_login (boolean)
  login_allowed (boolean)
  created_at

household_invitations (for household codes)
  id (UUID)
  household_id
  invitation_code (similar to household_code, or same)
  invited_email / invited_phone (optional)
  inviter_id (who sent it)
  accepted_by_id (who accepted - null until accepted)
  created_at
  accepted_at
  expires_at
```

**One home per person initially.**
**Spouse can join via household code → becomes secondary owner.**

---

#### 3️⃣ PREPAREDNESS (Safety Kit & Readiness)
```
household_readiness_scores
  id (UUID)
  household_id
  water_score (0-100)
  food_score (0-100)
  medical_score (0-100)
  power_score (0-100)
  mobility_risk (string: LOW | MEDIUM | HIGH)
  overall_readiness_pct (0-100)
  last_assessed
  updated_at

readiness_items
  id (UUID)
  household_id
  category ("WATER" | "FOOD" | "MEDICAL" | "POWER" | "MOBILITY")
  item_name
  description
  quantity
  status ("NEEDED" | "PARTIAL" | "STOCKED")
  created_at

readiness_checklist (optional, for UI)
  id
  household_id
  template_id (references a standard checklist)
  items_checked / items_total
  last_completed
```

**Completely separate from identity and home structure.**
**Always calculated per home, never per person.**

---

## 🔄 DATA FLOW (New)

### Signup
```
1. Create account (email, password)
   → auth.users created
   
2. Complete identity
   → profiles: name, phone, address
   
3. Auto-create home
   → households: one row, household_code generated
   → household_members: add primary user
   
4. Add household members (optional)
   → household_members: add 2nd adult, kids, grandma, etc.
   
5. Start safety setup (optional)
   → readiness_items: created from template
   → user checks items off
   → readiness_scores: calculated
   
6. Done.
```

### Join via Household Code
```
1. User downloads app, creates account
   ~ Same as signup steps 1-3
   
2. Choose "Join Existing Home"
   
3. Enter household code from spouse/partner
   → household_invitations: find by code
   → Check: code matches, not expired, not already accepted
   
4. Admin (spouse) approves
   → household_invitations: accept
   → household_members: add new user
   → readiness_scores: recalculate (more people = more items needed)
   
5. New user now sees same home, same readiness
```

### Join Organization (Separate)
```
1. User already has account + home + readiness

2. At any point: choose to "Join Community"
   → Enter org code (completely separate from household code)
   → org_members: user linked to org
   → org_vulnerabilities: user's vulnerability data synced to org (if consent)
   
3. Organization queries:
   → "42% of homes missing water" (aggregated)
   → Does NOT see: grandma's name, exact inventory
   
4. User can leave org anytime
   → org_members: delete
   → Home + readiness unaffected
```

---

## 🛠️ IMPLEMENTATION PHASES

### PHASE 1: Data Structure (Week 1)
#### Create new tables:
- [ ] `households`
- [ ] Refactor `household_members` (simplify)
- [ ] `household_invitations`
- [ ] `household_readiness_scores`
- [ ] `readiness_items`
- [ ] Migrate preparedness data out of `profiles`

#### Delete/Archive:
- [ ] `vitals` (merge essentials into `household_readiness_scores`)
- [ ] `vulnerability_profiles` (move consent to org-member relationship)
- [ ] `kit_recommendations` (move to readiness items)

#### Rename for clarity:
- [ ] `members` → `org_members` (only org-scoped)
- [ ] `household_members` concept stays but cleaner schema

---

### PHASE 2: Backend Routes (Week 1-2)
#### Create new API endpoints:

**Identity**
- `POST /auth/signup` - returns user + auto-created household
- `GET /profile` - just user account info
- `PATCH /profile` - update name, phone, address

**Household**
- `POST /households` - create home (called during signup)
- `GET /households/:id` - get household details
- `PATCH /households/:id` - update name only
- `GET /households/:id/code` - get household code (for sharing)
- `POST /households/:id/members` - add member
- `PATCH /households/:id/members/:memberId` - edit member
- `DELETE /households/:id/members/:memberId` - remove member
- `GET /households/:id/members` - list members

**Household Invitations**
- `POST /households/:id/invite` - generate code or send email
- `GET /invitations/:code` - check if valid
- `POST /invitations/:code/accept` - join household
- `DELETE /invitations/:id` - revoke

**Readiness**
- `POST /readiness/:householdId/items` - init from template
- `PATCH /readiness/:itemId` - check/uncheck
- `GET /readiness/:householdId/score` - get calculated score
- `GET /readiness/:householdId/gaps` - what's missing

**Organization (unchanged concept, cleaner)**
- `GET /orgs/:code` - get org info
- `POST /profile/join-org/:code` - user joins org
- `DELETE /profile/leave-org/:code` - user leaves org
- All org queries now aggregate by `org_members.profile_id` + `households` (not by individual profile)

---

### PHASE 3: Frontend Views (Week 2-3)
#### Simplify flow:

**Current (broken)**
```
SPLASH
  ↓
LOGIN
  ↓
REGISTRATION (3 steps: account setup + vitals + household)
  ↓
ACCOUNT_SETUP
  ↓
ORG_REGISTRATION (optional)
  ↓
DASHBOARD
```

**New (clean)**
```
SPLASH
  ↓
LOGIN / REGISTRATION
  ├─ Step 1: Identity (name, email, password, phone, address)
  ├─ Step 2: Add Household Members (optional at signup, can do later)
  ├─ Step 3: Welcome (shows auto-created home + household code)
  └─ DASHBOARD
      ├─ Your Home (members list)
      ├─ Safety Setup (readiness checklist) ← NEW SECTION
      └─ Settings
          ├─ Personal Info
          ├─ Household Management
          └─ Organization Connections (if any)
```

#### Views to create/refactor:
- [ ] `OnboardingFlow.tsx` - combines old REGISTRATION + ACCOUNT_SETUP
- [ ] `HouseholdView.tsx` - manages household members, shows code
- [ ] `ReadinessView.tsx` - safety kit checklist (replace current scattered prep)
- [ ] `ReadinessGapView.tsx` - shows gaps
- [ ] Keep `SettingsView.tsx` but simplify

#### Views to remove/deprecate:
- [x] Delete `OrgRegistrationView.tsx` (org join is optional, in Settings)
- [ ] Simplify `DashboardView.tsx` (no org-first navigation)
- [ ] Archive complex admin views (MapView, etc.) for Phase 2

---

### PHASE 4: Migration (Week 3-4)
#### For existing users:

```javascript
For each profile with household_members:
  1. Create households row
     household_code = generateCode()
     owner_id = profile.id
  
  2. Migrate household_members
     → Keep data, just link to household_id
  
  3. Migrate vitals + vulnerability_profiles
     → Create household_readiness_scores row
     → Create readiness_items rows from old data
  
  4. If profile.orgId exists:
     → Create org_members row
     → Validate org_code matches

For data integrity:
  - Log all migrations
  - Keep old tables as read-only for 30 days
  - Run verification queries
```

---

## 📋 FILES TO CREATE / MODIFY

### New Files (Database / Backend)
```
supabase/
  migrations/
    001_create_households.sql
    002_create_household_members.sql
    003_create_household_invitations.sql
    004_create_household_readiness.sql
    005_migrate_existing_users.sql
    
models/
  household.js (Mongoose, if keeping backend)
  
services/
  householdService.ts (household mgmt functions)
  readinessService.ts (preparedness calc)
```

### New Files (Frontend)
```
components/
  ReadinessChecklist.tsx
  HouseholdInvite.tsx
  
views/
  HouseholdView.tsx
  ReadinessView.tsx
  OnboardingFlow.tsx
```

### Modified Files
```
types.ts
  - Remove vitals fields from UserProfile
  - Add Household interface
  - Add ReadinessScore interface

App.tsx
  - Simplify ViewState
  - Remove ACCOUNT_SETUP, ORG_REGISTRATION states
  - Add HOUSEHOLD, READINESS states

views/RegistrationView.tsx
  - Merge with ACCOUNT_SETUP step
  - Add household member add (optional, can do in Settings later)

views/SettingsView.tsx
  - Move household mgmt to dedicated section
  - Remove org connection from main flow
  - Add invite household code display

services/api.ts
  - Add household CRUD functions
  - Add readiness calculation
  - Refactor org-related functions
```

---

## 🎯 SUCCESS CRITERIA

By end of implementation:

1. **Signup is 3 steps max** (identity → members → done)
2. **One consistent household model** (no two-member systems)
3. **Household code works** (spouse can join)
4. **Preparedness separate** (its own view, not mixed with profile)
5. **Zero data duplication** (each fact stored once)
6. **Clear mental model** (users understand: account → home → safety)
7. **Existing data migrated** (no lost history)
8. **Org connection is optional** (doesn't break anything)

---

## 🚨 GOTCHAS TO AVOID

1. **Don't keep old system running parallel** (confuses users, doubles work)
2. **Household code needs rate limiting** (prevent code guessing)
3. **When adding member, recalc readiness immediately** (or users get confused)
4. **If household has 0 members, don't break** (handle gracefully)
5. **Phone number for invite option** (not required for household join)
6. **Age groups, not exact age** (simpler, still useful: Adult/Teen/Child/Senior)
7. **Mobile flag vs medical flag** (both boolean, not a string)
8. **Don't delete household code** (keep history for auditing)

---

## 🗓️ TIMELINE

- **Week 1**: Database design + creation, migration scripts
- **Week 2**: Backend routes + services, partial frontend
- **Week 3**: Frontend views complete, household code UI
- **Week 4**: Testing, migration, go-live

**Total**: ~4 weeks, 1 developer

---

## 📞 DECISION POINTS (Need Your Input)

1. **Single invitation or email invite?**
   - Option A: Generate code, person manually enters
   - Option B: Enter email, send link, auto-accept
   - Recommendation: A (simpler, works offline)

2. **Age groups or exact age?**
   - Option A: Adult, Teen (13-17), Child (1-12), Infant (0-12 months), Senior (65+)
   - Option B: Keep exact age
   - Recommendation: A (cleaner, good enough for preparedness)

3. **One home per user always?**
   - Option A: Yes, one home per account (simplest)
   - Option B: Allow "multiple homes" later
   - Recommendation: A for Phase 1, can add later

4. **Household code format?**
   - Option A: 6 alphanumeric (e.g., "A3K7Q2")
   - Option B: 4 digit PIN (e.g., "1234")
   - Recommendation: A (harder to guess, easier to share in text)

5. **Organizations: required or optional?**
   - Option A: Only if user chooses (current plan)
   - Option B: Keep it but totally hidden for Phase 1
   - Recommendation: A (cleaner, less confusing)

---

## ✅ NEXT STEPS

1. Confirm the 5 decision points above
2. Review this plan with team
3. Create detailed SQL migrations
4. Start PHASE 1: Database
5. Parallel: Start PHASE 3: Frontend mockups

**Ready to proceed?**
