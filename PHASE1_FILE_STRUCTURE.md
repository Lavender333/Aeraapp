# Phase 1 Security Fixes - File Structure

## New Directory Structure

```
aera---emergency-response/
│
├── middleware/                          [NEW]
│   ├── auth.js                         ← JWT auth & org access control
│   └── validate.js                     ← Zod validation middleware
│
├── validation/                          [NEW]
│   └── schemas.js                      ← All Zod validation schemas
│
├── models/
│   ├── user.js                         [MODIFIED] ← resetToken → resetTokenHash
│   ├── inventory.js
│   ├── request.js
│   ├── memberStatus.js
│   ├── broadcast.js
│   ├── helpRequest.js
│   └── member.js
│
├── server.js                            [REPLACED] ← Secure implementation
├── server-new.js                        [NEW] ← Source for server.js
├── package.json                         [MODIFIED] ← Added security deps
│
├── PHASE1_README.md                     [NEW] ← Quick reference
├── PHASE1_IMPLEMENTATION_PLAN.md        [NEW] ← Detailed plan
├── PHASE1_TEST_PLAN.md                  [NEW] ← Test suite
├── PHASE1_DEPLOYMENT_CHECKLIST.md       [NEW] ← Deployment guide
├── PHASE1_EXECUTIVE_SUMMARY.md          [NEW] ← Executive summary
├── PHASE1_FILE_STRUCTURE.md             [NEW] ← This file
└── deploy-phase1.sh                     [NEW] ← Deployment script
│
└── [existing frontend files unchanged]
```

## File Relationships

```
┌─────────────────────────────────────────────────────────┐
│                      server.js                          │
│                   (Main Application)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Imports:                                               │
│  ├─ middleware/auth.js ─────────┐                      │
│  ├─ middleware/validate.js ─────┤                      │
│  ├─ validation/schemas.js ──────┼─ Security Layer      │
│  ├─ express-mongo-sanitize ─────┤                      │
│  └─ express-rate-limit ─────────┘                      │
│                                                         │
│  Uses:                                                  │
│  ├─ models/user.js (modified)                          │
│  ├─ models/inventory.js                                │
│  ├─ models/request.js                                  │
│  ├─ models/memberStatus.js                             │
│  ├─ models/broadcast.js                                │
│  ├─ models/helpRequest.js                              │
│  └─ models/member.js                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Request Flow (Secured)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────────────────────────────────┐
│      Express Middleware Chain           │
├─────────────────────────────────────────┤
│                                         │
│ 1. CORS ✓                               │
│    └─ Check allowed origins             │
│                                         │
│ 2. Body Parser ✓                        │
│    └─ Parse JSON                        │
│                                         │
│ 3. NoSQL Sanitize ✓ [express-mongo-s.] │
│    └─ Remove $, . operators             │
│                                         │
│ 4. Rate Limiter ✓ [express-rate-limit] │
│    └─ Check request count               │
│                                         │
│ 5. Router Selection                     │
│    ├─ Public Router → Skip to Step 7   │
│    └─ Protected Router → Continue       │
│                                         │
│ 6. Auth Middleware ✓ [middleware/auth] │
│    ├─ Verify JWT token                 │
│    ├─ Check expiry                     │
│    └─ Set req.user                     │
│                                         │
│ 7. Org Access Control [requireOrgAccess]│
│    └─ Verify orgId match               │
│                                         │
│ 8. Validation ✓ [middleware/validate]  │
│    ├─ Parse with Zod schema            │
│    └─ Return 400 if invalid            │
│                                         │
│ 9. Route Handler                        │
│    ├─ Execute business logic           │
│    └─ Database operations              │
│                                         │
└─────────────────────────────────────────┘
       │ HTTP Response
       ▼
┌─────────────┐
│   Client    │
└─────────────┘
```

## Security Layers

```
                                         ┌─────────────────┐
                                         │   Attacker      │
                                         └────────┬────────┘
                                                  │
                           ╔══════════════════════╧══════════════════════╗
                           ║          Layer 1: Rate Limiting              ║
                           ║  └─ Block brute force (5-100 req/15min)     ║
                           ╚══════════════════════╤══════════════════════╝
                                                  │
                           ╔══════════════════════╧══════════════════════╗
                           ║       Layer 2: Input Sanitization           ║
                           ║  └─ Remove NoSQL operators ($, .)           ║
                           ╚══════════════════════╤══════════════════════╝
                                                  │
                           ╔══════════════════════╧══════════════════════╗
                           ║        Layer 3: Schema Validation           ║
                           ║  └─ Zod schemas validate structure          ║
                           ╚══════════════════════╤══════════════════════╝
                                                  │
                           ╔══════════════════════╧══════════════════════╗
                           ║         Layer 4: Authentication             ║
                           ║  └─ JWT signature verification              ║
                           ╚══════════════════════╤══════════════════════╝
                                                  │
                           ╔══════════════════════╧══════════════════════╗
                           ║         Layer 5: Authorization              ║
                           ║  └─ Org-based and user-based access         ║
                           ╚══════════════════════╤══════════════════════╝
                                                  │
                                         ┌────────▼────────┐
                                         │   Database      │
                                         │   (Protected)   │
                                         └─────────────────┘
```

## Code Organization

### Public Routes (No Auth)
```javascript
// Defined in: server.js (publicRouter)
GET  /api/health              // No validation
POST /api/auth/register       // Validation: registerSchema
POST /api/auth/login          // Validation: loginSchema
POST /api/auth/forgot         // Validation: forgotPasswordSchema
POST /api/auth/reset          // Validation: resetPasswordSchema
```

### Protected Routes (Auth + Org Access)
```javascript
// Defined in: server.js (protectedRouter)
GET    /api/orgs/:orgId/inventory         // Auth + orgAccess
POST   /api/orgs/:orgId/inventory         // Auth + orgAccess + updateInventorySchema
GET    /api/orgs/:orgId/requests          // Auth + orgAccess
POST   /api/orgs/:orgId/requests          // Auth + orgAccess + createRequestSchema
POST   /api/requests/:id/status           // Auth + updateRequestStatusSchema
GET    /api/orgs/:orgId/status            // Auth + orgAccess
POST   /api/orgs/:orgId/status            // Auth + orgAccess + updateMemberStatusSchema
GET    /api/orgs/:orgId/broadcast         // Auth + orgAccess
POST   /api/orgs/:orgId/broadcast         // Auth + orgAccess + updateBroadcastSchema
GET    /api/orgs/:orgId/help              // Auth + orgAccess
GET    /api/users/:userId/help/active     // Auth + userAccess
POST   /api/users/:userId/help            // Auth + userAccess + createHelpRequestSchema
POST   /api/help/:id/location             // Auth + updateHelpLocationSchema
GET    /api/orgs/:orgId/members           // Auth + orgAccess
POST   /api/orgs/:orgId/members           // Auth + orgAccess + createMemberSchema
PUT    /api/orgs/:orgId/members/:id       // Auth + orgAccess + updateMemberSchema
DELETE /api/orgs/:orgId/members/:id       // Auth + orgAccess
```

## Validation Schemas

### Auth Schemas (validation/schemas.js)
- `registerSchema` - User registration
- `loginSchema` - User login
- `forgotPasswordSchema` - Password reset request
- `resetPasswordSchema` - Password reset with token

### Resource Schemas
- `updateInventorySchema` - Inventory updates
- `createRequestSchema` - Replenishment requests
- `updateRequestStatusSchema` - Request status updates
- `updateMemberStatusSchema` - Member safety status
- `updateBroadcastSchema` - Broadcast messages
- `createHelpRequestSchema` - SOS/help requests
- `updateHelpLocationSchema` - Help request location
- `createMemberSchema` - New member creation
- `updateMemberSchema` - Member updates

## Middleware Chain Example

### Example 1: Login Request (Public)
```
Request: POST /api/auth/login
Body: { email: "user@example.com", password: "pass123" }

Flow:
1. CORS ✓ (allowed origin)
2. Body Parser ✓ (JSON parsed)
3. NoSQL Sanitize ✓ (no operators)
4. Rate Limiter ✓ (attempt 2/5)
5. Public Router → /auth/login
6. Auth Limiter ✓ (strict limit)
7. Validate ✓ (loginSchema)
8. Handler → Find user, verify password, sign JWT
9. Response: { token: "...", user: {...} }
```

### Example 2: Get Inventory (Protected)
```
Request: GET /api/orgs/CH-9921/inventory
Headers: { Authorization: "Bearer eyJ..." }

Flow:
1. CORS ✓
2. Body Parser ✓
3. NoSQL Sanitize ✓
4. Rate Limiter ✓ (request 15/100)
5. Protected Router → /orgs/:orgId/inventory
6. Auth Middleware ✓ (JWT valid, req.user set)
7. requireOrgAccess ✓ (user.orgId === CH-9921)
8. Handler → Query inventory
9. Response: { orgId: "CH-9921", water: 100, ... }
```

### Example 3: Attack Blocked (NoSQL Injection)
```
Request: POST /api/auth/login
Body: { email: {"$ne": null}, password: {"$ne": null} }

Flow:
1. CORS ✓
2. Body Parser ✓ (JSON parsed)
3. NoSQL Sanitize ✓ ($ replaced with _)
   └─ Body now: { email: {"_ne": null}, ... }
4. Rate Limiter ✓
5. Public Router → /auth/login
6. Validate ✗ (loginSchema fails)
   └─ Error: "Invalid email format"
7. Response: 400 { error: "validation failed", ... }

Attack BLOCKED at Layer 3 (even after Layer 2 sanitization)
```

## Database Schema Changes

### User Model (models/user.js)

**Before:**
```javascript
{
  // ... other fields
  resetToken: String,           // PLAIN TEXT ❌
  resetTokenExpiresAt: Date
}
```

**After:**
```javascript
{
  // ... other fields
  resetTokenHash: String,       // SHA-256 HASH ✅
  resetTokenExpiresAt: Date
}
```

**Migration**: Automatic (old field unused, new field added)

## Environment Variables

### Required
```bash
JWT_SECRET=<64-char-hex>        # NEW REQUIREMENT
MONGODB_URI=<connection-string>
MONGODB_DB=aeraapp
```

### Optional
```bash
FRONTEND_ORIGIN=<url>           # CORS
PORT=4000                        # Server port
NODE_ENV=production              # Environment
```

## Backup Strategy

```
backups/
└── phase1-20260205-143022/
    ├── server.js.bak
    ├── package.json.bak
    └── user.js.bak
```

## Rollback Procedure

```bash
# If issues arise, restore from backup
BACKUP_DIR="backups/phase1-YYYYMMDD-HHMMSS"
cp $BACKUP_DIR/server.js.bak server.js
cp $BACKUP_DIR/package.json.bak package.json
cp $BACKUP_DIR/user.js.bak models/user.js
npm install  # Restore old dependencies
npm run server
```

---

**File Structure Version**: 1.0  
**Date**: February 5, 2026  
**Phase**: 1 - Critical Security Fixes
