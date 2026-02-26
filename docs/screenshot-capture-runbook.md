# AERA Screenshot Capture Runbook

Date: 2026-02-25

This runbook is the fastest path to capture the presentation visuals end-to-end:
1) person onboarding,
2) org admin single-location,
3) org admin multi-location,
4) lifecycle handoff visuals.

## Verified Login Accounts (Supabase)

All verified against current `VITE_SUPABASE_URL` project.

- `ng1001.orgadmin@aera.demo` / `AeraDemo!2026`
- `pastor@example.com` / `AeraDemo!2026`
- `alice@example.com` / `AeraDemo!2026`
- `david@example.com` / `AeraDemo!2026`

## Org Model Setup (Already Applied)

- Parent org: `NG-1001`
- Child orgs under parent: `CH-9921`, `NGO-5500`

## Before You Capture

- Run app: `npm run dev`
- Use one browser window size for all captures (consistency)
- Hard refresh once (`Cmd+Shift+R`)
- If stale auth appears, clear site storage for localhost and sign in again
- Keep naming convention exactly as below

## Reference Deck Source

- Target visual reference: `/Users/antoinettemckinney/Downloads/aerapres.pdf`
- Deck size: 9 pages
- Note: this PDF is image-only (text is not embedded), so match by visual composition and sequence order.

## Folder Structure

Create these folders:

- `deck_screenshots/live/01_person_onboarding/`
- `deck_screenshots/live/02_org_admin_single/`
- `deck_screenshots/live/03_org_admin_multi/`
- `deck_screenshots/live/04_lifecycle_handoff/`
- `deck_screenshots/mock/` (for any overlay-only visuals)

## Capture Sequence (Do In Order — PDF First)

Primary rule: capture in the exact order of `aerapres.pdf` pages.

### Page-by-Page Capture Order (`aerapres.pdf`)

1. **Page 1** → Slide 1 (Title)
2. **Page 2** → Slides 2–4 (Activation trilogy)
3. **Page 3** → Slides 5–7 (Person entry + household setup)
4. **Page 4** → Slides 8–10 (Member dashboard + help flow + checklist)
5. **Page 5** → Slides 11–12 (Single-location org operations)
6. **Page 6** → Slides 13–14 (Inventory placeholder + network vs single)
7. **Page 7** → Slides 15–18 (Helion declaration + readiness + logistics)
8. **Page 8** → Slides 19–21 (Impact + population + recovery)
9. **Page 9** → Slides 22–24 (Community code scale + strategic close)

### Account by Page Block (Role-Based)

- **Page 1**: no login required (title)
- **Page 2**: `ng1001.orgadmin@aera.demo` (Org Admin, network)
- **Page 3**: `alice@example.com` (General Member)
- **Page 4**: `alice@example.com` (General Member)
- **Page 5**: `pastor@example.com` (Org Admin, single-location)
- **Page 6**: `ng1001.orgadmin@aera.demo` (Org Admin, network)
- **Page 7**: `ng1001.orgadmin@aera.demo` (Org Admin, network)
- **Page 8**: `alice@example.com` for impact check-ins, then `ng1001.orgadmin@aera.demo` for population/recovery views
- **Page 9**: `ng1001.orgadmin@aera.demo` (Org Admin, network)

All accounts use password: `AeraDemo!2026`.

Use the capture inventory below to source each page block.

### A) Person Onboarding (login as member)

Login account: `alice@example.com` / `AeraDemo!2026`

1. `01_person_01_splash.png` — Splash / app entry
2. `01_person_02_login_empty.png` — Login form empty
3. `01_person_03_registration_entry.png` — Registration start screen
4. `01_person_04_setup_household.png` — Account setup household info
5. `01_person_05_setup_preparedness.png` — Preparedness fields (medical/transport/pets)
6. `01_person_06_dashboard_connected.png` — Member dashboard connected to community
7. `01_person_07_help_safety_check.png` — Help flow safety decision screen
8. `01_person_08_help_review_submit.png` — Help review/submit screen
9. `01_person_09_help_success.png` — Submission success confirmation

### B) Org Admin — Single Location

Login account: `pastor@example.com` / `AeraDemo!2026`

1. `02_single_01_org_dashboard_overview.png` — CH-9921 overview
2. `02_single_02_members_list.png` — Members list
3. `02_single_03_member_detail_ping.png` — Member detail + ping action
4. `02_single_04_preparedness_tab.png` — Preparedness tab
5. `02_single_05_inventory_tab.png` — Inventory + requests
6. `02_single_06_broadcast_compose.png` — Broadcast compose modal
7. `02_single_07_broadcast_confirm.png` — Broadcast confirmation state

### C) Org Admin — Multi-Location Network

Login account: `ng1001.orgadmin@aera.demo` / `AeraDemo!2026`

1. `03_multi_01_parent_overview.png` — NG-1001 parent overview
2. `03_multi_02_all_locations_rollup.png` — “All locations” aggregate view
3. `03_multi_03_child_ch9921_view.png` — Child org selected: CH-9921
4. `03_multi_04_child_ngo5500_view.png` — Child org selected: NGO-5500
5. `03_multi_05_broadcast_targets.png` — Multi-target broadcast selection
6. `03_multi_06_network_vs_single_pair.png` — Side-by-side comparison frame source

### D) Lifecycle Handoff Visuals

Use either member or admin context as needed.

1. `04_lifecycle_01_handoff_helion.png` — Transition card: “Let’s fast-forward. Hurricane Helion is announced.”
2. `04_lifecycle_02_threat_to_impact_ops.png` — Ops state (threat/readiness/impact)
3. `04_lifecycle_03_recovery_reporting.png` — Recovery/reporting state

## Recommended Slide Mapping

- Slides 1–4: Activation narrative (institution speaks first → code issued → announcement)
- Slides 5–10: Person onboarding + preparedness (Section A)
- Slides 11–14: Org operations (single + multi model, Sections B–C)
- Slides 15–21: Helion lifecycle (threat → impact → recovery, Section D)
- Slides 22–24: Scale + strategic close

## 9-Page Export Mapping (`aerapres.pdf`)

Use this as the required export order for the compact executive deck.

1. Page 1 → Slide 1 (Title)
2. Page 2 → Slides 2–4 (Activation trilogy)
3. Page 3 → Slides 5–7 (Person entry + household setup)
4. Page 4 → Slides 8–10 (Member dashboard + help flow + checklist)
5. Page 5 → Slides 11–12 (Single-location org operations)
6. Page 6 → Slides 13–14 (Inventory placeholder + network vs single)
7. Page 7 → Slides 15–18 (Helion declaration + readiness + logistics)
8. Page 8 → Slides 19–21 (Impact + population + recovery)
9. Page 9 → Slides 22–24 (Community code scale + strategic close)

## If Login Fails During Capture

1. Confirm exact app origin (local dev URL recommended)
2. Hard refresh
3. Sign out fully and retry
4. Re-run seeds:
   - `node scripts/seed-ng1001-members.mjs`
   - `node scripts/seed-capture-users.mjs`

## Re-run Setup Scripts

- Create/update capture users: `node scripts/seed-capture-users.mjs`
- Link org hierarchy: `node scripts/link-capture-org-hierarchy.mjs`
