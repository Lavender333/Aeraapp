# SIMPLIFICATION PLAN: COMPLETE OVERVIEW

**Status**: Plan Complete, Ready for Implementation Decisions

**Created**: February 13, 2026

---

## 📋 WHAT YOU NOW HAVE

I've analyzed your current AERA codebase and created a **comprehensive simplification blueprint** across 4 detailed documents:

### 1. **ARCHITECTURE_REVIEW_AND_PLAN.md** ← START HERE
- Current state analysis (what's broken)
- New simplified structure (3 clean parts)
- Implementation timeline (4 weeks)
- Decision points (need your input)
- Success criteria

**Read time: 15 minutes**

### 2. **IMPLEMENTATION_ROADMAP_DETAILED.md** ← TECHNICAL DETAILS
- Exact SQL migrations
- Backend API route map (with code examples)
- Frontend components (with TypeScript)
- Service layer functions
- UI flow mockups

**Read time: 30 minutes**

### 3. **CURRENT_vs_NEW_DETAILED.md** ← CLARITY
- Side-by-side comparison of every data structure
- User journey examples (old way vs new way)
- Why each change matters
- Table schema comparisons
- Admin view changes

**Read time: 20 minutes**

### 4. **DECISION_CHECKLIST.md** ← ACTION
- 10 specific decisions (choose A or B)
- Quick explanations for each
- Recommended path (but yours to customize)
- Approval gates before coding starts

**Read time: 10 minutes**

---

## 🎯 THE BIG IDEA (TL;DR)

### Three Clean Buckets (Not Mixed):

#### 1️⃣ **YOUR ACCOUNT** (Identity)
Just you:
- Name, email, password, phone, address

#### 2️⃣ **YOUR HOME** (Structure)
Automatically created when you sign up:
- Members (you, spouse, kids, grandma)
- Household code (A3K7Q2) for invite
- Optional login for family members

#### 3️⃣ **YOUR SAFETY** (Preparedness)
Separate section, separate questions:
- Do you have 3 days of water?
- Do you have backup power?
- Calculated per home (not per person)
- One readiness score: 0-100%

### Household Codes Work:
- Spouse downloads → creates their own account + home
- You share code "A3K7Q2" via text
- Spouse enters code → joins your home
- Now you see the same household + shared readiness
- Done.

### Organization Connection (Separate):
- Household code ≠ Organization code
- Choosing to join org is optional
- Org sees: "42% of homes missing water" (not personal data)
- User can leave anytime

---

## 📊 CURRENT STATE PROBLEMS

Your system works, but feels chaotic because:

1. **Profile bloat**: Contains identity + household info + health data + org stuff all mixed
2. **No household concept**: Household members stored as JSON in profile, no database table
3. **Missing household codes**: Can't invite spouse to share home
4. **Preparedness scattered**: Data in vitals, vulnerability_profiles, kit_recommendations (3 places)
5. **Registration chaos**: 3 steps (REGISTRATION → ACCOUNT_SETUP → ORG_REGISTRATION) with unclear purpose
6. **Data duplication**: Same info stored multiple times
7. **Org-first design**: System assumes users join organizations (they don't always)

---

## ✅ NEW STATE: BENEFITS

1. **Signup fast**: 2 steps, 5 minutes (not 3 steps, 10 minutes)
2. **Household codes work**: Spouse can actually join
3. **One readiness score**: Clear "Your home is 45% ready"
4. **Data integrity**: Each fact stored once, no duplication
5. **Linear flow**: Account → Home → Safety (clear mental model)
6. **Org optional**: Doesn't confuse core experience
7. **Per-home readiness**: When you add member, score recalcs
8. **Scalable**: Can add "multiple homes" later without redesign

---

## 🛠️ WHAT CHANGES

### Database
- ✅ Create: `households`, `household_members`, `household_invitations`
- ✅ Create: `household_readiness_scores`, `readiness_items`
- ✅ Rename: `members` → `org_members` (clarity)
- ✅ Archive: `vitals`, `vulnerability_profiles`, `kit_recommendations` (migrate data)
- ✅ Simplify: `profiles` (remove 30+ fields that belong elsewhere)

### Backend APIs
- ✅ Create: 25+ new endpoints (household CRUD, readiness, invitations)
- ✅ Refactor: Organization endpoints (now that profiles are clean)
- ✅ Remove: Scattered preparedness endpoints

### Frontend
- ✅ Simplify: `RegistrationView.tsx` (merge 2 steps)
- ✅ Create: `HouseholdInvite.tsx`, `HouseholdJoinFlow.tsx`, `ReadinessChecklist.tsx`
- ✅ Create: `HouseholdView.tsx`, `ReadinessView.tsx`
- ✅ Refactor: `SettingsView.tsx` (organize sections)
- ✅ Simplify: `DashboardView.tsx` (remove org-first nav)

### Type Definitions
- ✅ Add: `Household`, `HouseholdInvitation`, `ReadinessScore`, `ReadinessItem`
- ✅ Simplify: `UserProfile` (remove 20+ mixed fields)

### Views
- ✅ Remove: ACCOUNT_SETUP (merge into REGISTRATION)
- ✅ Remove: ORG_REGISTRATION (move to settings, optional)
- ✅ Add: HOUSEHOLD view (manage members + share code)
- ✅ Add: READINESS view (the checklist)

---

## 📈 TIMELINE

| Phase | What | Duration |
|-------|------|----------|
| **1** | Database design + migrations | 1 week |
| **2** | Backend API routes + services | 1 week |
| **3** | Frontend components + views | 1 week |
| **4** | Migration + testing + launch | 1 week |
| **Total** | Simplified system live | **4 weeks** |

Could be faster with 2 developers. Could be slower if existing users need large migration.

---

## 🚀 NEXT STEPS (IN ORDER)

### Step 1: Read & Decide ✅ **YOU ARE HERE**
- [ ] Read ARCHITECTURE_REVIEW_AND_PLAN.md
- [ ] Read IMPLEMENTATION_ROADMAP_DETAILED.md
- [ ] Read CURRENT_vs_NEW_DETAILED.md
- [ ] Fill out DECISION_CHECKLIST.md

### Step 2: Confirm (You Do This)
- [ ] Reply with: "Ready to implement" + decision checklist answers
- [ ] Or ask clarifying questions (that's fine too)

### Step 3: Start Phase 1 (I Do This)
- [ ] Create SQL migrations
- [ ] Validate migrations against existing data
- [ ] Create migration script for existing users

### Step 4: Continue (Iterative)
- [ ] Build backend (routes + services)
- [ ] Build frontend (views + components)
- [ ] Test both together
- [ ] Migrate existing data
- [ ] Launch

---

## 🔑 KEY DECISIONS (Locked)

These decisions are now finalized in `DECISION_CHECKLIST.md`:

1. **Age groups**: DOB entry (`MM/DD/YYYY`), age group derived automatically.
2. **Invitations**: Manual code.
3. **Spouse perms**: View-only default.
4. **Flags**: Mobility/medical required.
5. **Readiness items**: Standardized template.
6. **Score calc**: Auto-update.
7. **Member login**: Optional per person.
8. **Homes per account**: Multiple if needed (one primary home UX).
9. **Org join**: Available at signup and Settings; disconnect allowed in Settings.
10. **Item quantities**: Scale by household size.

---

## ❓ FAQ

**Q: Will existing users lose their data?**
A: No. We'll migrate it:
- Household members → new table
- Preparedness data → readiness items
- Profile stays, just cleaned
- Org connections preserved

**Q: Timeline too aggressive?**
A: Can adjust. 4 weeks assumes:
- Experienced dev
- No major external work
- Can focus full-time
- Existing test suite helps

**Q: What if I want to keep old system running parallel?**
A: Not recommended. Splits testing, confuses users. Better: hard cutover with 1-week rollback window.

**Q: Can I add multiple homes later?**
A: Yes. This design makes it easy. Just add a `household_order` field later.

**Q: Do orgs see individual preparedness data?**
A: No. They see aggregates:
- "42% missing water" (not Bob's water)
- "5 members high-risk" (not names)
- Opt-in consent before sharing

**Q: What about organizations that aren't NGOs?**
A: Household code is completely separate. Never for orgs. Org codes are org_code field. Clean separation.

**Q: Will the app be faster?**
A: Yes, slightly. Fewer fields in profile, more focused queries. But main benefit is clarity + usability, not speed.

**Q: What's the hardest part?**
A: Migration of existing users without losing data. Solution: careful mapping + verification queries + 90-day archive period.

---

## 📞 QUESTIONS?

Before you read the detailed docs, let me know if:

- [ ] You want me to explain any design choice
- [ ] You're concerned about timeline
- [ ] You want to discuss migration strategy
- [ ] You want code examples for a specific piece
- [ ] You want to see mockups of the new UI
- [ ] Something doesn't make sense

I'm here to clarify. No surprises when we start coding.

---

## ✋ HOLD ON: DO THIS FIRST

Before diving into the detailed documents:

### A. Read the Executive Summary (this document)

### B. Decide: Do These 3 Things Make Sense?

1. **Three buckets** (Account / Home / Safety) = clear separation?
2. **Household codes** (share to spouse) = solves the use case?
3. **Preparedness separate** (not part of profile) = better mental model?

If all 3 are YES → proceed to detailed docs.
If NO → let's talk about which part needs changing.

### C. Estimate Effort

- Database changes: ~3-4 days (SQL + migrations)
- Backend: ~5-6 days (endpoints + services)
- Frontend: ~5-6 days (views + components)
- Testing + migration: ~3-4 days
- Total: ~4 weeks (1 dev, full-time)

Does this fit your timeline?

---

## 🎬 NEXT

Decisions are locked and implementation can proceed against `DECISION_CHECKLIST.md`.

Recommended next sequence:
1. Enforce required member flags + DOB validation in forms and API.
2. Apply quantity scaling by household size in readiness calculations.
3. Add org join/disconnect controls in Signup + Settings parity.
4. Add optional per-member login toggles and invite flow.

---

## 📚 FILES CREATED FOR YOU

```
ARCHITECTURE_REVIEW_AND_PLAN.md
├─ Current state analysis
├─ New structure (3 parts)
├─ Implementation phases
└─ 5 key decisions

IMPLEMENTATION_ROADMAP_DETAILED.md
├─ SQL migrations (ready to run)
├─ API route map (25+ endpoints)
├─ Frontend components (with code)
├─ Service functions (with code)
└─ UI mockups

CURRENT_vs_NEW_DETAILED.md
├─ Side-by-side data model
├─ User journey improvements
├─ Admin view changes
└─ Summary table

DECISION_CHECKLIST.md
├─ 10 decisions (A or B each)
├─ Explanations
└─ Approval gate
```

All files are in your root directory. Start with ARCHITECTURE_REVIEW_AND_PLAN.md.

---

**Status: Awaiting your decisions. Ready when you are. 🚀**
