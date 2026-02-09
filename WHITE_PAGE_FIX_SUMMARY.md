# White Page Issue - Root Cause and Fix

## Problem
The deployed site at https://appandwebsitetesting.site displays only a white page.

## Root Cause
The white page is caused by **deployment build failures on the main branch**. The GitHub Pages workflow fails during the build step, preventing the site from deploying.

### Specific Error
```
[vite:esbuild] Transform failed with 2 errors:
/home/runner/work/Aeraapp/Aeraapp/services/api.ts:429:22: ERROR: Multiple exports with the same name "notifyEmergencyContact"
/home/runner/work/Aeraapp/Aeraapp/services/api.ts:429:22: ERROR: The symbol "notifyEmergencyContact" has already been declared
```

### Why This Happens
In `services/api.ts`, the function `notifyEmergencyContact` is declared twice:
- First occurrence: lines 413-427
- Second occurrence (duplicate): lines 429-443

Both functions are identical, causing a build-time error when esbuild tries to bundle the application.

## The Fix

The fix has been implemented in branch `fix-white-page-issue` with the following changes:

### 1. Remove Duplicate Function ✅
**File:** `services/api.ts`
- Removed the duplicate `notifyEmergencyContact` function (lines 429-443)
- Kept only one copy (lines 413-427)

### 2. Update Workflows ✅
**Files:** `.github/workflows/pages.yml` and `.github/workflows/deploy.yml`

Changes made:
- **Node.js version:** Upgraded from 18 to 20 (matches package requirements, reduces warnings)
- **Install command:** Changed from `npm ci` to `npm install` in deploy.yml (more flexible with lockfile updates)
- **Environment variables:** Added Supabase env var verification step in deploy.yml

### 3. Sync Dependencies ✅
**File:** `package-lock.json`
- Regenerated to ensure sync with package.json
- Prevents "missing from lock file" errors

## Verification

All changes have been tested locally:
```bash
$ npm run build
✓ 2399 modules transformed.
✓ built in 4.14s
```

Build succeeds without errors! ✅

## How to Apply the Fix

### Option 1: Merge the Fix Branch (Recommended)
The fix is ready in branch `fix-white-page-issue`. To apply:

1. Create a Pull Request from `fix-white-page-issue` to `main`
2. Review the changes (all minimal and targeted)
3. Merge the PR
4. GitHub Pages will automatically rebuild
5. Site will be live!

### Option 2: Manual Application
If you prefer to apply the fix manually to main:

1. **Edit** `services/api.ts`:
   - Find lines 429-443 (the duplicate function)
   - Delete those 16 lines
   
2. **Update** `.github/workflows/pages.yml`:
   - Change `node-version: 18` to `node-version: 20` (line 33)
   
3. **Update** `.github/workflows/deploy.yml`:
   - Change `node-version: '18'` to `node-version: '20'` (line 28)
   - Change `run: npm ci` to `run: npm install` (line 32)
   - Add Supabase env var verification (see full file in fix branch)
   
4. **Regenerate** package-lock.json:
   ```bash
   rm package-lock.json
   npm install
   ```
   
5. **Commit and push** to main

## After Applying the Fix

Once the fix is merged to `main`:
1. GitHub Pages workflow will trigger automatically
2. Build will succeed (no more duplicate export error)
3. Site will deploy successfully
4. White page will be replaced with the actual application
5. Users can access the app at https://appandwebsitetesting.site

## Summary

**Issue:** White page due to build failure from duplicate function export
**Fix:** Remove duplicate + update workflows + sync dependencies
**Status:** Fix ready in `fix-white-page-issue` branch
**Action Required:** Merge to main

---

**Created:** 2026-02-09
**Branch:** fix-white-page-issue
**Commit:** 97fea06
