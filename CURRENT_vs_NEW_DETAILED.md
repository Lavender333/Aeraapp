# CURRENT vs NEW: SIDE-BY-SIDE COMPARISON

This document shows exactly what changes from the current system to the simplified one.

---

## 1. USER IDENTITY PROFILE

### ❌ CURRENT (Bloated)
```typescript
export interface UserProfile {
  id: string;
  fullName: string;
  email?: string;
  createdAt?: string;
  phone: string;
  address: string;
  
  // Household info (should be separate)
  householdMembers: number;
  household: HouseholdMember[];
  petDetails: string;
  medicalNeeds: string;
  
  // Structural vulnerabilities (should be separate)
  zipCode?: string;
  medicationDependency?: boolean;
  insulinDependency?: boolean;
  oxygenPoweredDevice?: boolean;
  mobilityLimitation?: boolean;
  transportationAccess?: boolean;
  financialStrain?: boolean;
  consentPreparednessPlanning?: boolean;
  consentTimestamp?: string;
  
  // Org stuff (optional, should be in separate table)
  communityId: string;
  
  // Notification prefs (ok here)
  notifications: { push: boolean; sms: boolean; email: boolean; };
  
  // Meta (ok here)
  role: UserRole;
  language: LanguageCode;
  active: boolean;
}
```

**Problem**: Profile does 5 different jobs at once.

### ✅ NEW (Clean)
```typescript
export interface UserProfile {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  language?: LanguageCode;
  active: boolean;
  
  // Computed relationships (not stored in user profile table)
  household?: Household;
  householdMembers?: HouseholdMember[];
  readinessScore?: HouseholdReadinessScore;
  
  // Notifications (optional)
  notifications?: { push: boolean; sms: boolean; email: boolean; };
  
  createdAt: string;
  updatedAt: string;
}
```

**Why**: Profile is just identity. Everything else is in its own place.

---

## 2. HOUSEHOLD STRUCTURE

### ❌ CURRENT
```typescript
export interface HouseholdMember {
  id: string;
  name: string;
  age: string;              // Freeform text "5", "3 months", "Grandma"
  needs: string;            // Freeform text "Oxygen", "Walking assistance"
}

// Stored in: profiles.household (JSON array)
// Problem: Only local, no sharing, no invitation system
```

### ✅ NEW
```typescript
// Table: households
export interface Household {
  id: string;
  owner_id: string;         // The person who owns the account
  name: string;             // e.g., "Your Home"
  household_code: string;   // e.g., "A3K7Q2" - for inviting others
  created_at: string;
  updated_at: string;
}

// Table: household_members
export interface HouseholdMember {
  id: string;
  household_id: string;
  name: string;
  age_group: 'Adult' | 'Teen' | 'Child' | 'Senior' | 'Infant'; // Fixed options
  mobility_flag: boolean;   // Is this member in a wheelchair? Needs help moving?
  medical_flag: boolean;    // Does this member have a medical condition?
  requires_login: boolean;  // Can this person have a login?
  login_allowed: boolean;   // Should they actually log in?
  created_at: string;
  updated_at: string;
}

// Table: household_invitations
export interface HouseholdInvitation {
  id: string;
  household_id: string;
  invitation_code: string;  // Same as household_code or generated
  inviter_id: string;       // Who sent the invite
  accepted_by_id?: string;  // Who accepted (null until they do)
  created_at: string;
  accepted_at?: string;
  expires_at: string;       // 30 days from now
}
```

**Why**: Household is now a real entity with sharing capability.

---

## 3. PREPAREDNESS / SAFETY KIT

### ❌ CURRENT
```
Data scattered across:
  - profiles.medicalNeeds (string)
  - profiles.petDetails (string)
  - vitals table (full health record)
  - vulnerability_profiles table (demographics)
  - kit_recommendations table (what items needed)
  
Problem: No single readiness score. Don't know what's checked off.
         Mixed with identity.
```

### ✅ NEW
```typescript
// Table: household_readiness_scores
export interface HouseholdReadinessScore {
  id: string;
  household_id: string;
  overall_readiness_pct: number; // 0-100 (main metric!)
  water_days: number;            // How many days of water stocked
  food_days: number;             // How many days of food stocked
  power_backup: boolean;         // Have backup power source?
  medical_supplies: boolean;     // Have medical supplies?
  mobility_risk: 'LOW' | 'MEDIUM' | 'HIGH'; // Risk assessment
  last_assessed?: string;
  updated_at: string;
}

// Table: readiness_items (the actual checklist)
export interface ReadinessItem {
  id: string;
  household_id: string;
  category: 'WATER' | 'FOOD' | 'MEDICAL' | 'POWER' | 'MOBILITY' | 'COMMUNICATION';
  item_name: string;
  description?: string;
  quantity_needed: number;
  quantity_have: number;
  unit: string;              // 'gallons', 'days', 'count', 'doses'
  status: 'NEEDED' | 'PARTIAL' | 'STOCKED';
  checked_at?: string;
  created_at: string;
  updated_at: string;
}
```

**Why**: 
- One clear readiness score per home
- Items are trackable (not just yes/no)
- Completely separate from identity​
- Per-household, not per-person

---

## 4. HOUSEHOLD CODES

### ❌ CURRENT
**They don't exist.**
- No way to invite someone to join your household
- System assumes everyone creates their own profile
- No shared homes

### ✅ NEW
```
When household created:
  - Auto-generate household_code (e.g., "A3K7Q2")
  - Display prominently in Settings
  - User can share it with spouse/partner
  
When someone uses code:
  - They enter the code
  - System creates household_invitation record
  - Owner (spouse) gets notified (optional)
  - On acceptance: add user as household_member
  - Both users now see same household + readiness
  - Readiness recalculates for 2+ people
  
Code expires after 30 days (configurable)
Can generate new code anytime
```

**Why**: Enables the core use case ("my spouse wants to join").

---

## 5. ORGANIZATION CONNECTION

### ❌ CURRENT
```typescript
// In UserProfile:
communityId: string;

Problem: 
  - Org is mixed into user profile
  - User can only join ONE org
  - Org-first logic everywhere
  - Unclear if org is required
```

### ✅ NEW
```
Separate table: org_members
  id
  org_id
  profile_id
  role (optional)
  consent (for data sharing)
  joined_at
  left_at (if they leave)

User → Household [always]
User → Org [optional, 1 or more] ← Much cleaner

In Settings:
  [Card: "Organization Connections"]
  
  Not joined to any org yet
  [Button: "Join Organization"]
    → Enter org code
    → We might: request your vulnerability data
    → You choose: yes or no
    → Done
    
  Already joined to "Red Cross Chapter"
  [Button: Leave Organization]

Flow:
  1. User signs up and creates home (required)
  2. At any point, user can join org (optional)
  3. User doesn't join org? Org doesn't see them. That's fine.
  4. User can leave org anytime (data cleaned up)
```

**Why**: Organization is truly optional and doesn't confuse the core flow.

---

## 6. REGISTRATION / ONBOARDING FLOW

### ❌ CURRENT
```
SPLASH
  ↓
LOGIN / REGISTRATION (Step 1: Account)
  → email, password, phone, address
  ↓
ACCOUNT_SETUP (Step 2: But wait, there's more)
  → fullName (?? why not in registration)
  → More identity stuff
  ↓
ORG_REGISTRATION (Step 3: Required? Optional? Who knows)
  → "Do you want to join an organization?"
  → Or create one?
  → Confusing.
  ↓
DASHBOARD

Problem: 3 screens that should be 1-2. Unclear what's required.
```

### ✅ NEW
```
SPLASH
  ↓
LOGIN / REGISTRATION (ONE STEP)
  Screen 1: Identity
    ├─ Email
    ├─ Password
    ├─ Full Name
    ├─ Phone (optional)
    └─ Address (optional)
    
    [Next]
    
  Screen 2: Household Members (Optional)
    ├─ Instructions: "Who lives in your home?"
    ├─ Add Person button
    │   ├─ Name
    │   ├─ Age Group (Adult/Teen/Child/Senior)
    │   ├─ Mobility? (yes/no)
    │   └─ Medical condition? (yes/no)
    ├─ Can be empty (= just you)
    └─ [Done - Go to Dashboard]
    ↓
DASHBOARD
  ├─ Welcome card
  ├─ "Your Home" showing members
  ├─ "Start Safety Setup" CTA
  └─ Settings → Organization (if they want to join later)

Total: 2 screens, clear purpose, nothing confusing.
```

**Why**: Same information, but clear and linear.

---

## 7. DATA MODEL: TABLES & STORAGE

### ❌ CURRENT (Fragmented)
```
auth.users (basic identity)

profiles (mixed everything)
  ├─ identity fields
  ├─ household info (array)
  ├─ health flags
  ├─ vulnerability data
  └─ org reference

household_members (if exists, local storage only)
  └─ Not linked to actual household concept

vitals (health info)
  └─ Per-profile, not per-home

vulnerability_profiles (demographics)
  └─ Per-profile, repeated per org

kit_recommendations (preparedness)
  └─ Scattered across orgs

members (organization-scoped)
  └─ Different `members` concept than household
  └─ Can't tell which one is which

organizations
  ├─ Only for NGOs, Churches, etc.
  └─ No household organizations
```

### ✅ NEW (Organized)
```
auth.users
  └─ Just auth: id, email, password_hash, created_at

profiles
  ├─ id, full_name, email, phone, address
  ├─ language_preference, active
  ├─ created_at, updated_at
  └─ ✅ CLEAN - just identity

households
  ├─ id, owner_id, name, household_code
  ├─ created_at, updated_at
  └─ One per user (initially)

household_members
  ├─ id, household_id, name, age_group
  ├─ mobility_flag, medical_flag
  ├─ requires_login, login_allowed
  └─ created_at, updated_at

household_invitations
  ├─ id, household_id, invitation_code
  ├─ inviter_id, accepted_by_id
  ├─ created_at, accepted_at, expires_at
  └─ For household code invites

household_readiness_scores
  ├─ id, household_id
  ├─ overall_readiness_pct, water_days, food_days
  ├─ power_backup, medical_supplies, mobility_risk
  ├─ last_assessed, updated_at
  └─ Single score per home

readiness_items
  ├─ id, household_id, category, item_name
  ├─ quantity_needed, quantity_have, unit
  ├─ status (NEEDED/PARTIAL/STOCKED)
  └─ The checklist

org_members (renamed from members for clarity)
  ├─ id, org_id, profile_id
  ├─ role, consent, joined_at, left_at
  └─ Links people to organizations

organizations
  ├─ id, org_code, name, type
  ├─ address, contact, replenishment_info
  ├─ verified, active
  └─ Community orgs (optional for users)
```

**Why**: Each table has ONE purpose.

---

## 8. VIEWS / SCREENS

### ❌ CURRENT
```
SPLASH
LOGIN
REGISTRATION (Step 1)
ACCOUNT_SETUP (Step 2)
ORG_REGISTRATION (Step 3)
DASHBOARD (but what goes here?)
SETTINGS (also mixed up)
├─ Edit profile
├─ Edit household
├─ Manage org
├─ Manage members
└─ Manage vulnerability data

+ Many admin views:
  ALERTS
  ASSESSMENT
  GAP
  MAP
  DRONE
  LOGISTICS
  ORG_DASHBOARD
  POPULATION
  RECOVERY
  + MORE...

Problem: Too many views. Unclear hierarchy. User gets lost.
```

### ✅ NEW (Phase 1)
```
SPLASH → Splash screen (quick check)

LOGIN → Login or create account

REGISTRATION → Two-step signup
  1. Identity (email, password, name, phone, address)
  2. Household members (optional add people)

DASHBOARD → Main view
  ├─ Your Home (card with members)
  │  └─ [Invite code button]
  ├─ Safety Setup (readiness score card)
  │  └─ [Start] or [View Progress]
  ├─ Help/Emergency (if relevant)
  └─ Navigation bar: Home | Safety | Settings

READINESS VIEW → Full-page readiness checklist
  ├─ By category (Water, Food, Medical, Power, Mobility)
  ├─ Checkboxes for items
  ├─ Score updates live
  └─ Gaps highlighted

SETTINGS → All management
  ├─ Personal Info (name, phone, address)
  ├─ Household
  │  └─ Members list + manage
  │  └─ Invite code + share
  │  └─ Leave household (if not owner)
  └─ Organizations (optional)
      └─ Join new org
      └─ List joined orgs
      └─ Leave org

(Admin views moved to Phase 2)
```

**Why**: Clear hierarchy. User always knows where they are.

---

## 9. USER JOURNEY: "Add Spouse to Home"

### ❌ CURRENT
**Not possible.**
- Spouse creates separate account
- Spouse has separate household
- Spouse has separate readiness
- No shared view
- Confusing mess

### ✅ NEW
```
Step 1: Original user (Alice)
  ├─ Already signed up
  ├─ Has household "Your Home" with code "A3K7Q2"
  ├─ Shows 1 member (herself)
  ├─ Shows readiness score 45%

Step 2: Spouse (Bob) downloads app
  ├─ Creates account
  ├─ System auto-creates "Your Home" for Bob as well
  ├─ Bob sees dashboard with 0 members
  ├─ Bob sees readiness 0%

Step 3: Alice shares code "A3K7Q2" with Bob
  ├─ Via text, email, or verbal

Step 4: Bob goes to Settings → Household → Join Home
  ├─ Enters "A3K7Q2"
  ├─ System finds Alice's household
  ├─ Bob's profile added to household
  ├─ Alice gets notification (optional)

Step 5: Now both see same view
  ├─ Same members list (Alice + Bob + kids)
  ├─ Same readiness score
  ├─ Can both edit and check items
  ├─ Perfect

Step 6: (Optional) Add kids to household
  ├─ Either Alice or Bob can add them
  ├─ Both see changes immediately
  ├─ Readiness recalculates (now 4 people = more items needed)
```

**Why**: Core use case actually works.

---

## 10. USER JOURNEY: "Join Organization"

### ❌ CURRENT
```
During REGISTRATION:
  → User forced to consider org
  → Confusing
  
Later:
  → Hard to find how to join
  → org_id baked into profile
  → Can't easily switch orgs
```

### ✅ NEW
```
Any time:
  1. Settings → Organizations
     [Currently not joined to any organization]
     [Button: "Join Community"]
     
  2. Enter org code (e.g., "NG-1001")
     Modal: "Red Cross Springfield wants to connect"
     "They'll receive: Your preparedness score & vulnerabilities (if you consent)"
     [Toggle: Share my data?] YES / NO
     
  3. Confirm
     → Not stored in profile
     → Stored in org_members table
     → org_members.consent = yes/no
     
  4. Org sees:
     ✅ That you exist
     ✅ Your readiness score
     ✅ Your demographics (if consented)
     ❌ Your exact inventory
     ❌ Your address
     ❌ Family medical details
     
  5. Leave anytime:
     Settings → Organizations → Red Cross
     [Button: "Leave"]
     → Removed from org_members
     → Org can't see you anymore
```

**Why**: Optional, clear, gives users control.

---

## 11. ADMIN VIEW: What Org Sees

### ❌ CURRENT
```
Probably sees:
  - Individual members + personal data
  - Exact inventories
  - Health conditions
  - Names and contact info
  - Can't aggregate meaningfully
```

### ✅ NEW
```
Organization admin sees aggregated data:

Dashboard Stats:
  ├─ "42 members in NG-1001"
  │  └─ How many consented: 35
  │
  ├─ "Preparedness Breakdown"
  │  ├─ 15% fully prepared (>90%)
  │  ├─ 45% partially prepared (40-90%)
  │  ├─ 40% need help (<40%)
  │
  ├─ "Top Gaps"
  │  ├─ 72% missing water (> 3 days)
  │  ├─ 58% missing food supply
  │  ├─ 38% need mobility assistance
  │
  ├─ "Member Check-in Status"
  │  ├─ 28 safe
  │  ├─ 7 in danger
  │  ├─ 7 unknown
  │
  └─ Export? CSV: "Readiness_Report_Feb_2026.csv"

What org does NOT see:
  ❌ Individual names (aggregated only)
  ❌ Exact inventories (just gaps)
  ❌ Medical conditions
  ❌ Family photos/info
  ❌ Addresses (uses zip code)

Why: Privacy. Org gets enough data for planning, not enough to be creepy.
```

---

## SUMMARY TABLE

| Aspect | ❌ Current | ✅ New |
|--------|-----------|--------|
| **Profile** | 50 fields mixed | 8 fields, clean |
| **Home/Household** | No concept | Real entity, shareable |
| **Household codes** | Don't exist | Auto-generated, works |
| **Preparedness** | Scattered & vague | Tables + clear score |
| **Org relationship** | Mixed in profile | Separate, optional |
| **Registration steps** | 3 steps (confusing) | 2 steps (clear) |
| **Household members** | Local only | Database table |
| **Invitation system** | None | Built in |
| **Readiness calc** | Ad-hoc | Automatic, per-home |
| **Data model** | Fragmented | Normalized |
| **User clarity** | Low | High |
| **Time to implement** | N/A | ~4 weeks |

---

## NEXT STEPS

1. **Confirm decision points** from ARCHITECTURE_REVIEW_AND_PLAN.md
2. **Build migration script** to move existing data
3. **Create new tables** in Supabase
4. **Build backend endpoints** (see IMPLEMENTATION_ROADMAP_DETAILED.md)
5. **Update frontend** step-by-step
6. **Test migrations** with existing data
7. **Launch** with old system as fallback for 1 week

Questions? Let's clarify before we start writing code.
