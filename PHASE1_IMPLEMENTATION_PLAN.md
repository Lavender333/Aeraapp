# Phase 1: Critical Security Fixes - Implementation Plan

## Overview
This document provides a step-by-step implementation plan for Phase 1 security fixes to make the AERA app safe for controlled beta testing.

## Implementation Steps

### Step 1: Install Required Dependencies
```bash
npm install zod express-mongo-sanitize express-rate-limit
```

### Step 2: Backup Current Server
```bash
cp server.js server-backup.js
```

### Step 3: Apply New Security Implementation
```bash
# Replace server.js with the secured version
cp server-new.js server.js
```

### Step 4: Update Environment Variables
See "Deployment Checklist" section below for required environment variables.

### Step 5: Test Locally
Run the test plan (see "Test Plan" section) to verify all vulnerabilities are fixed.

### Step 6: Deploy to Staging
Follow deployment checklist to deploy to staging environment and verify.

### Step 7: Verify in Staging
Run the test plan against staging environment.

---

## Changes Summary

### 1. Authentication Enforcement ✅
**Problem**: Protected routes were not enforcing authentication globally.

**Fix**:
- Created `middleware/auth.js` with robust JWT verification
- Restructured `server.js` into:
  - `publicRouter` - No auth required (health, register, login, password reset)
  - `protectedRouter` - All routes require auth middleware
- Added `requireOrgAccess()` middleware for org-based access control
- Added user-based access control for help requests

**Files Changed**:
- `middleware/auth.js` (new)
- `server.js` (restructured)

### 2. JWT Secret Validation ✅
**Problem**: JWT_SECRET had unsafe fallback to 'dev-secret'.

**Fix**:
- Removed fallback completely
- Added fail-fast validation on server boot:
  - JWT_SECRET must be set
  - JWT_SECRET must be minimum 32 characters
- Server exits with clear error message if invalid

**Files Changed**:
- `server.js` (lines 45-58)

### 3. Password Reset Security ✅
**Problem**: Reset tokens were exposed in API responses and stored in plain text.

**Fix**:
- Generate cryptographically secure tokens using `crypto.randomBytes(32)`
- Store ONLY hashed token (`SHA-256`) in database
- Never return token in API response
- Compare hashed tokens during reset
- In dev mode: log token to console (simulating email)
- In production: token sent via email only (TODO comment added)

**Files Changed**:
- `models/user.js` - Changed `resetToken` to `resetTokenHash`
- `server.js` - Updated `/auth/forgot` and `/auth/reset` routes

### 4. Input Sanitization & Validation ✅
**Problem**: No protection against NoSQL injection or malformed input.

**Fix**:
- Added `express-mongo-sanitize` globally to prevent NoSQL injection
  - Replaces prohibited characters (`$`, `.`) with `_`
  - Logs sanitization warnings
- Created Zod schemas for all request inputs in `validation/schemas.js`
- Created `validate()` middleware factory in `middleware/validate.js`
- Applied validation to ALL routes with request bodies

**Files Changed**:
- `middleware/validate.js` (new)
- `validation/schemas.js` (new)
- `server.js` - Applied validation to all routes

### 5. Rate Limiting ✅
**Problem**: No protection against brute force attacks.

**Fix**:
- Auth endpoints: 5 requests per 15 minutes (strict)
  - `/auth/login`
  - `/auth/register`
  - `/auth/forgot`
  - `/auth/reset`
- General API: 100 requests per 15 minutes
- Returns clear error messages with 429 status

**Files Changed**:
- `server.js` - Added rate limiters

---

## Breaking Changes

### ⚠️ BREAKING CHANGE 1: Password Reset Token Format
**Impact**: Existing reset tokens in database will be invalidated.

**Reason**: Changed from `resetToken` (plain text) to `resetTokenHash` (SHA-256 hash).

**Migration**: 
- Existing users with pending reset tokens will need to request a new token
- No data migration needed - field renamed in schema

**Mitigation**: Communicate to users that password reset tokens expire after 15 minutes anyway.

### ⚠️ BREAKING CHANGE 2: JWT_SECRET Required
**Impact**: Server will not start without valid JWT_SECRET.

**Reason**: Security fix - removed unsafe fallback.

**Migration**: Must set JWT_SECRET environment variable (minimum 32 characters).

**Mitigation**: See deployment checklist for generation instructions.

### ⚠️ NOTICE: Rate Limiting
**Impact**: Clients making too many requests will receive 429 errors.

**Reason**: Security fix - prevent brute force attacks.

**Mitigation**: 
- Normal usage unaffected (limits are generous)
- Frontend should handle 429 errors gracefully
- Consider implementing exponential backoff for retries

---

## Non-Breaking Enhancements

### Input Validation
- More descriptive error messages
- Field-level validation errors returned in response
- Coercion of types (strings to numbers, etc.)

### Security Headers
- Rate limit headers sent in responses (`RateLimit-*`)

### Logging
- NoSQL injection attempts logged
- Password reset tokens logged in dev mode

---

## Code Patch Details

### middleware/auth.js
```javascript
// New file - see middleware/auth.js
// Exports: auth, requireRole, requireOrgAccess
```

### middleware/validate.js
```javascript
// New file - see middleware/validate.js
// Exports: validate(schema, source)
```

### validation/schemas.js
```javascript
// New file - see validation/schemas.js
// Exports: All Zod schemas for request validation
```

### models/user.js
```diff
- resetToken: { type: String },
+ resetTokenHash: { type: String },
```

### server.js
See `server-new.js` for complete restructured implementation.

Key changes:
1. Fail-fast JWT_SECRET validation (lines 45-58)
2. Global middleware: sanitization, rate limiting (lines 73-95)
3. Password reset with hashed tokens (lines 200-265)
4. Split into publicRouter and protectedRouter (lines 109+, 267+)
5. Validation on all routes with request bodies
6. Org-based and user-based access control

---

## Dependencies Added

```json
{
  "zod": "^3.22.4",
  "express-mongo-sanitize": "^2.2.0",
  "express-rate-limit": "^7.1.5"
}
```

---

## Environment Variables Impact

### New Requirements:
- `JWT_SECRET` - Now REQUIRED (was optional with fallback)
- `NODE_ENV` - Used to control password reset token logging

### Existing (no change):
- `MONGODB_URI`
- `MONGODB_DB`
- `FRONTEND_ORIGIN`
- `PORT`

---

## Testing Strategy

See "Test Plan" section for specific curl commands to verify each fix.

### Test Categories:
1. Auth bypass prevention
2. JWT token forgery prevention
3. Password reset token exposure
4. NoSQL injection prevention
5. Rate limit enforcement

---

## Rollback Plan

If issues arise:
```bash
# Restore original server
cp server-backup.js server.js

# Restart server
npm run server
```

Note: Password reset tokens created during new implementation will not work after rollback.

---

## Next Steps (Not in Phase 1)

- Implement email service for password reset tokens
- Add refresh token rotation
- Implement CSRF protection for session-based auth
- Add request logging/audit trail
- Consider implementing 2FA for admin accounts

---

**Implementation Date**: February 5, 2026  
**Phase**: 1 - Critical Security Fixes  
**Status**: Ready for Testing
