# AERA - Complete Implementation Roadmap
# Phases 1-3: Security → Supabase → Migration

## 📋 Executive Summary

This document provides a complete Jira-ready sprint backlog for the AERA hybrid migration plan covering:
- **Phase 1** (Weeks 1-3): Critical Security Fixes
- **Phase 2** (Weeks 2-7): Supabase Build in Parallel  
- **Phase 3** (Weeks 4-8): Migration + Cutover + Cleanup

**Total Duration**: 8 weeks  
**Team**: Backend (2), Frontend (2), DevOps (1), QA (1)

---

## 🎯 Epics Overview

| Epic ID | Epic Name | Phase | Duration | Priority |
|---------|-----------|-------|----------|----------|
| **SEC-01** | Critical Security Fixes | 1 | Weeks 1-3 | P0 |
| **SUP-01** | Supabase Infrastructure Setup | 2 | Weeks 2-4 | P0 |
| **SUP-02** | Supabase Backend Development | 2 | Weeks 3-6 | P0 |
| **SUP-03** | Frontend Supabase Integration | 2 | Weeks 4-7 | P0 |
| **MIG-01** | Data Migration & Dual-Write | 3 | Weeks 4-6 | P0 |
| **MIG-02** | Cutover & Go-Live | 3 | Weeks 7-8 | P0 |
| **CLN-01** | Cleanup & Optimization | 3 | Week 8 | P1 |

---

## EPIC: SEC-01 - Critical Security Fixes (Phase 1)

**Duration**: Weeks 1-3  
**Owner**: Backend Team  
**Dependencies**: None  
**Risk**: P0 (blocking beta launch)

### Definition of Done
- [ ] All 5 critical vulnerabilities fixed
- [ ] 19 security test cases pass
- [ ] JWT_SECRET validation enforced
- [ ] Rate limiting active on all environments
- [ ] Password reset tokens hashed in database
- [ ] NoSQL injection prevention verified
- [ ] Deployed to staging and production
- [ ] Security audit completed

---

### Story SEC-101: Enforce Authentication Middleware
**Points**: 5 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** system administrator  
**I want** all protected routes to require authentication  
**So that** unauthorized users cannot access sensitive data

**Acceptance Criteria**:
- [ ] Create `middleware/auth.js` with JWT verification
- [ ] Create `requireOrgAccess()` middleware for org-level security
- [ ] Restructure `server.js` into public and protected routers
- [ ] Apply auth middleware globally to protected router
- [ ] Test: unauthenticated requests return 401
- [ ] Test: invalid tokens return 401
- [ ] Test: users cannot access other orgs' data (403)

**Tasks**:
- [ ] Create middleware/auth.js (2h)
- [ ] Add requireOrgAccess and requireRole functions (1h)
- [ ] Refactor server.js router structure (3h)
- [ ] Add unit tests for auth middleware (2h)
- [ ] Integration test with real API calls (2h)

**Dependencies**: None

---

### Story SEC-102: Remove JWT Secret Fallback
**Points**: 3 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** security engineer  
**I want** the server to fail on boot if JWT_SECRET is invalid  
**So that** we never run with insecure default secrets

**Acceptance Criteria**:
- [ ] Remove fallback to 'dev-secret'
- [ ] Validate JWT_SECRET exists on boot
- [ ] Validate JWT_SECRET is minimum 32 characters
- [ ] Server exits with clear error message if invalid
- [ ] Update deployment docs with secret generation instructions
- [ ] Test: server won't start without JWT_SECRET
- [ ] Test: server won't start with short JWT_SECRET

**Tasks**:
- [ ] Add JWT_SECRET validation in server.js (1h)
- [ ] Create clear error messages (0.5h)
- [ ] Update deployment documentation (1h)
- [ ] Test fail-fast behavior (1h)
- [ ] Update CI/CD to validate secrets (2h)

**Dependencies**: None

---

### Story SEC-103: Secure Password Reset Flow
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 2

**As a** user  
**I want** secure password reset tokens  
**So that** my account cannot be hijacked

**Acceptance Criteria**:
- [ ] Generate cryptographically secure 32-byte tokens
- [ ] Store only SHA-256 hash in database
- [ ] Never return token in API response
- [ ] Token expires after 15 minutes
- [ ] Token cannot be reused after password reset
- [ ] Dev mode: log token to console
- [ ] Production: send token via email (TODO marked)
- [ ] Update User model: `resetToken` → `resetTokenHash`

**Tasks**:
- [ ] Update User model schema (1h)
- [ ] Implement token hashing with crypto (2h)
- [ ] Update /auth/forgot endpoint (2h)
- [ ] Update /auth/reset endpoint (2h)
- [ ] Add dev mode console logging (1h)
- [ ] Add TODO comment for email service (0.5h)
- [ ] Write tests for reset flow (3h)
- [ ] Test token expiry (1h)

**Dependencies**: None

---

### Story SEC-104: Add Input Sanitization & Validation
**Points**: 13 | **Priority**: P0 | **Owner**: Backend Dev 2

**As a** developer  
**I want** all inputs validated and sanitized  
**So that** NoSQL injection and malformed data are prevented

**Acceptance Criteria**:
- [ ] Install and configure express-mongo-sanitize
- [ ] Create Zod schemas for all API endpoints
- [ ] Create validate() middleware factory
- [ ] Apply validation to all routes with request bodies
- [ ] Log sanitization warnings for monitoring
- [ ] Test: NoSQL operators blocked ($, .)
- [ ] Test: Invalid email formats rejected
- [ ] Test: Missing required fields rejected
- [ ] Test: Invalid enum values rejected

**Tasks**:
- [ ] Install zod and express-mongo-sanitize (0.5h)
- [ ] Configure mongo-sanitize middleware (1h)
- [ ] Create middleware/validate.js (1h)
- [ ] Create validation/schemas.js with all schemas (4h)
- [ ] Apply validation to auth routes (1h)
- [ ] Apply validation to inventory routes (1h)
- [ ] Apply validation to request routes (1h)
- [ ] Apply validation to help request routes (1h)
- [ ] Apply validation to member routes (1h)
- [ ] Write validation tests (4h)
- [ ] Test NoSQL injection prevention (2h)

**Dependencies**: None

---

### Story SEC-105: Implement Rate Limiting
**Points**: 5 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** system administrator  
**I want** rate limiting on API endpoints  
**So that** brute force attacks are prevented

**Acceptance Criteria**:
- [ ] Install express-rate-limit
- [ ] Configure auth rate limit: 5 req/15min
- [ ] Configure general API rate limit: 100 req/15min
- [ ] Return 429 with clear error message
- [ ] Include rate limit headers in responses
- [ ] Test: 6th auth request blocked
- [ ] Test: 101st API request blocked
- [ ] Test: rate limit headers present

**Tasks**:
- [ ] Install express-rate-limit (0.5h)
- [ ] Configure auth limiter (1h)
- [ ] Configure API limiter (1h)
- [ ] Apply to routes (1h)
- [ ] Write rate limit tests (2h)
- [ ] Load testing (2h)

**Dependencies**: None

---

### Story SEC-106: Create Security Test Suite
**Points**: 8 | **Priority**: P0 | **Owner**: QA Engineer

**As a** QA engineer  
**I want** comprehensive security tests  
**So that** all vulnerabilities are verified as fixed

**Acceptance Criteria**:
- [ ] Create test plan document with curl commands
- [ ] Automate test suite with bash script
- [ ] Test auth bypass prevention (3 tests)
- [ ] Test token forgery prevention (3 tests)
- [ ] Test reset token exposure (5 tests)
- [ ] Test NoSQL injection prevention (3 tests)
- [ ] Test rate limiting (2 tests)
- [ ] Test input validation (3 tests)
- [ ] All 19 tests pass

**Tasks**:
- [ ] Write test plan documentation (3h)
- [ ] Create automated test script (4h)
- [ ] Run tests against local environment (1h)
- [ ] Run tests against staging (1h)
- [ ] Document test results (1h)

**Dependencies**: SEC-101, SEC-102, SEC-103, SEC-104, SEC-105

---

### Story SEC-107: Deploy Security Fixes to Production
**Points**: 5 | **Priority**: P0 | **Owner**: DevOps

**As a** DevOps engineer  
**I want** to deploy security fixes to production  
**So that** the app is safe for beta launch

**Acceptance Criteria**:
- [ ] Generate production JWT_SECRET
- [ ] Update environment variables in all environments
- [ ] Deploy to staging successfully
- [ ] Run test suite on staging
- [ ] Deploy to production successfully
- [ ] Run smoke tests on production
- [ ] Monitor for errors (24 hours)
- [ ] Document rollback procedure

**Tasks**:
- [ ] Generate production secrets (0.5h)
- [ ] Update staging environment vars (0.5h)
- [ ] Deploy to staging (1h)
- [ ] Run security test suite on staging (1h)
- [ ] Update production environment vars (0.5h)
- [ ] Deploy to production (1h)
- [ ] Run production smoke tests (1h)
- [ ] Set up monitoring alerts (2h)
- [ ] Document deployment (1h)

**Dependencies**: SEC-106

---

## EPIC: SUP-01 - Supabase Infrastructure Setup (Phase 2)

**Duration**: Weeks 2-4  
**Owner**: DevOps + Backend  
**Dependencies**: None (parallel to Phase 1)  
**Risk**: P0

### Definition of Done
- [ ] Supabase project created and configured
- [ ] PostgreSQL schema deployed
- [ ] RLS policies active and tested
- [ ] Realtime enabled for critical tables
- [ ] Storage buckets configured
- [ ] Environment variables documented
- [ ] CI/CD pipeline updated

---

### Story SUP-201: Create Supabase Project
**Points**: 3 | **Priority**: P0 | **Owner**: DevOps

**As a** DevOps engineer  
**I want** a Supabase project set up  
**So that** we can start development

**Acceptance Criteria**:
- [ ] Create Supabase project (dev/staging/prod)
- [ ] Configure project settings
- [ ] Set up database connection pooling
- [ ] Configure API rate limits
- [ ] Set up authentication providers
- [ ] Document connection details

**Tasks**:
- [ ] Create Supabase account and projects (1h)
- [ ] Configure project settings (1h)
- [ ] Set up auth providers (email, phone) (1h)
- [ ] Configure rate limits (0.5h)
- [ ] Document setup (1h)

**Dependencies**: None

---

### Story SUP-202: Deploy PostgreSQL Schema
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** backend developer  
**I want** the PostgreSQL schema deployed  
**So that** we have the database structure ready

**Acceptance Criteria**:
- [ ] Run schema.sql in Supabase SQL editor
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Verify all triggers created
- [ ] Verify all functions created
- [ ] Verify all views created
- [ ] Insert seed data for development

**Tasks**:
- [ ] Review and finalize schema.sql (2h)
- [ ] Deploy schema to dev environment (1h)
- [ ] Deploy schema to staging environment (1h)
- [ ] Verify table structure (1h)
- [ ] Verify indexes (0.5h)
- [ ] Verify triggers and functions (1h)
- [ ] Insert seed data (1h)
- [ ] Document schema (1h)

**Dependencies**: SUP-201

---

### Story SUP-203: Deploy RLS Policies
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** security engineer  
**I want** Row Level Security policies enforced  
**So that** users can only access their organization's data

**Acceptance Criteria**:
- [ ] Enable RLS on all tables
- [ ] Deploy all RLS policies from rls-policies.sql
- [ ] Test admin can access all data
- [ ] Test users can only access their org data
- [ ] Test institution admins can manage their org
- [ ] Test users can only see their own help requests
- [ ] Document RLS policy logic

**Tasks**:
- [ ] Review and finalize rls-policies.sql (2h)
- [ ] Deploy RLS policies to dev (1h)
- [ ] Create test users for different roles (1h)
- [ ] Test admin policies (1h)
- [ ] Test org-level policies (2h)
- [ ] Test user-level policies (1h)
- [ ] Document policies (1h)

**Dependencies**: SUP-202

---

### Story SUP-204: Configure Realtime Subscriptions
**Points**: 5 | **Priority**: P1 | **Owner**: Backend Dev 2

**As a** frontend developer  
**I want** realtime subscriptions configured  
**So that** the frontend can receive live updates

**Acceptance Criteria**:
- [ ] Enable realtime for help_requests
- [ ] Enable realtime for broadcasts
- [ ] Enable realtime for inventory
- [ ] Enable realtime for member_statuses
- [ ] Enable realtime for replenishment_requests
- [ ] Test realtime subscriptions work
- [ ] Document realtime configuration

**Tasks**:
- [ ] Enable realtime in Supabase dashboard (0.5h)
- [ ] Configure publication for tables (1h)
- [ ] Create test realtime subscription (1h)
- [ ] Test realtime with INSERT/UPDATE/DELETE (2h)
- [ ] Document realtime setup (1h)

**Dependencies**: SUP-202

---

### Story SUP-205: Set Up Storage Buckets
**Points**: 3 | **Priority**: P2 | **Owner**: DevOps

**As a** user  
**I want** to upload profile avatars  
**So that** my profile is personalized

**Acceptance Criteria**:
- [ ] Create 'avatars' storage bucket
- [ ] Configure bucket policies
- [ ] Enable public access for avatars
- [ ] Test file upload
- [ ] Test file deletion
- [ ] Document storage setup

**Tasks**:
- [ ] Create storage buckets (0.5h)
- [ ] Configure bucket policies (1h)
- [ ] Test upload/download (1h)
- [ ] Document storage (1h)

**Dependencies**: SUP-201

---

## EPIC: SUP-02 - Supabase Backend Development (Phase 2)

**Duration**: Weeks 3-6  
**Owner**: Backend Team  
**Dependencies**: SUP-01  
**Risk**: P0

### Definition of Done
- [ ] All API endpoints implemented with Supabase
- [ ] Edge Functions deployed for complex logic
- [ ] Authentication working end-to-end
- [ ] All CRUD operations tested
- [ ] Performance benchmarked
- [ ] API documentation updated

---

### Story SUP-301: Implement Authentication with Supabase Auth
**Points**: 13 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** user  
**I want** to authenticate with Supabase  
**So that** I can access the application securely

**Acceptance Criteria**:
- [ ] Implement signup with email/password
- [ ] Implement login with email/password
- [ ] Implement password reset
- [ ] Implement profile creation on signup
- [ ] Test authentication flow
- [ ] Test password reset flow
- [ ] Document auth integration

**Tasks**:
- [ ] Set up Supabase Auth configuration (1h)
- [ ] Implement signup endpoint/function (3h)
- [ ] Implement login endpoint/function (2h)
- [ ] Implement password reset (3h)
- [ ] Create profile on auth.users trigger (2h)
- [ ] Write auth tests (3h)
- [ ] Document auth flow (1h)

**Dependencies**: SUP-203

---

### Story SUP-302: Implement Organization CRUD Operations
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 2

**As an** admin  
**I want** to manage organizations  
**So that** I can onboard new churches and NGOs

**Acceptance Criteria**:
- [ ] Create organization
- [ ] Read organization(s)
- [ ] Update organization
- [ ] Delete organization (soft delete)
- [ ] Test RLS enforcement
- [ ] Document API endpoints

**Tasks**:
- [ ] Implement create organization (2h)
- [ ] Implement read organizations (1h)
- [ ] Implement update organization (2h)
- [ ] Implement soft delete (1h)
- [ ] Write CRUD tests (2h)
- [ ] Document endpoints (1h)

**Dependencies**: SUP-203

---

### Story SUP-303: Implement Inventory Management
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 2

**As an** organization admin  
**I want** to manage inventory  
**So that** I can track supplies

**Acceptance Criteria**:
- [ ] Get inventory for organization
- [ ] Update inventory levels
- [ ] Test auto-creation on org create
- [ ] Test RLS (org-level access)
- [ ] Test inventory validation (non-negative)

**Tasks**:
- [ ] Implement get inventory (1h)
- [ ] Implement update inventory (2h)
- [ ] Test auto-creation trigger (1h)
- [ ] Test RLS policies (2h)
- [ ] Write inventory tests (2h)

**Dependencies**: SUP-302

---

### Story SUP-304: Implement Replenishment Requests
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 1

**As an** organization member  
**I want** to request supply replenishment  
**So that** we can restock depleted resources

**Acceptance Criteria**:
- [ ] Create replenishment request
- [ ] List requests for organization
- [ ] Update request status
- [ ] Auto-update inventory on STOCKED status
- [ ] Test RLS policies
- [ ] Test status workflow

**Tasks**:
- [ ] Implement create request (2h)
- [ ] Implement list requests (1h)
- [ ] Implement update status (2h)
- [ ] Create trigger for inventory update (2h)
- [ ] Write request tests (2h)
- [ ] Document workflow (1h)

**Dependencies**: SUP-303

---

### Story SUP-305: Implement Help Request (SOS) System
**Points**: 13 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** user in distress  
**I want** to submit help requests  
**So that** first responders can find me

**Acceptance Criteria**:
- [ ] Create help request
- [ ] List help requests (org and user views)
- [ ] Update help request status
- [ ] Update help request location
- [ ] Assign to first responder
- [ ] Mark as resolved
- [ ] Test RLS policies (user and org access)
- [ ] Test realtime notifications

**Tasks**:
- [ ] Implement create help request (2h)
- [ ] Implement list help requests (2h)
- [ ] Implement update status (2h)
- [ ] Implement update location (1h)
- [ ] Implement assignment logic (2h)
- [ ] Write help request tests (3h)
- [ ] Test realtime (2h)
- [ ] Document API (1h)

**Dependencies**: SUP-301

---

### Story SUP-306: Implement Member Management
**Points**: 8 | **Priority**: P1 | **Owner**: Backend Dev 2

**As an** institution admin  
**I want** to manage member directory  
**So that** I can track community members

**Acceptance Criteria**:
- [ ] Create member
- [ ] List members for organization
- [ ] Update member information
- [ ] Delete member
- [ ] Test RLS (institution admin only)

**Tasks**:
- [ ] Implement create member (2h)
- [ ] Implement list members (1h)
- [ ] Implement update member (2h)
- [ ] Implement delete member (1h)
- [ ] Write member tests (2h)

**Dependencies**: SUP-302

---

### Story SUP-307: Implement Broadcasts
**Points**: 5 | **Priority**: P1 | **Owner**: Backend Dev 2

**As an** institution admin  
**I want** to post broadcasts  
**So that** I can send alerts to members

**Acceptance Criteria**:
- [ ] Get broadcast for organization
- [ ] Update broadcast message
- [ ] Test auto-creation on org create
- [ ] Test realtime updates

**Tasks**:
- [ ] Implement get broadcast (1h)
- [ ] Implement update broadcast (2h)
- [ ] Test realtime (1h)
- [ ] Write broadcast tests (1h)

**Dependencies**: SUP-302

---

## EPIC: SUP-03 - Frontend Supabase Integration (Phase 2)

**Duration**: Weeks 4-7  
**Owner**: Frontend Team  
**Dependencies**: SUP-02  
**Risk**: P0

### Definition of Done
- [ ] Frontend fully integrated with Supabase
- [ ] Authentication working in UI
- [ ] All CRUD operations working
- [ ] Realtime subscriptions active
- [ ] Offline support implemented
- [ ] Error handling complete
- [ ] User testing completed

---

### Story SUP-401: Install and Configure Supabase Client
**Points**: 3 | **Priority**: P0 | **Owner**: Frontend Dev 1

**As a** frontend developer  
**I want** Supabase client configured  
**So that** I can interact with the backend

**Acceptance Criteria**:
- [ ] Install @supabase/supabase-js
- [ ] Create Supabase client wrapper
- [ ] Configure environment variables
- [ ] Test connection to Supabase

**Tasks**:
- [ ] Install @supabase/supabase-js (0.5h)
- [ ] Create services/supabase.ts (1h)
- [ ] Configure env vars (0.5h)
- [ ] Test connection (1h)

**Dependencies**: SUP-02 started

---

### Story SUP-402: Migrate Authentication to Supabase
**Points**: 13 | **Priority**: P0 | **Owner**: Frontend Dev 1

**As a** user  
**I want** to authenticate via Supabase  
**So that** I can log in securely

**Acceptance Criteria**:
- [ ] Update LoginView to use Supabase auth
- [ ] Update RegistrationView to use Supabase auth
- [ ] Implement password reset flow
- [ ] Store session in localStorage
- [ ] Handle auth state changes
- [ ] Test login/logout flow
- [ ] Test registration flow
- [ ] Test password reset flow

**Tasks**:
- [ ] Update LoginView.tsx (3h)
- [ ] Update RegistrationView.tsx (3h)
- [ ] Implement password reset UI (2h)
- [ ] Handle auth state (2h)
- [ ] Update routing for auth (2h)
- [ ] Write auth tests (2h)

**Dependencies**: SUP-301, SUP-401

---

### Story SUP-403: Migrate Dashboard to Supabase
**Points**: 13 | **Priority**: P0 | **Owner**: Frontend Dev 2

**As a** user  
**I want** my dashboard to load from Supabase  
**So that** I see real-time data

**Acceptance Criteria**:
- [ ] Fetch inventory from Supabase
- [ ] Fetch help requests from Supabase
- [ ] Fetch broadcasts from Supabase
- [ ] Fetch member statuses from Supabase
- [ ] Subscribe to realtime updates
- [ ] Handle loading states
- [ ] Handle errors gracefully

**Tasks**:
- [ ] Update DashboardView.tsx data fetching (4h)
- [ ] Add realtime subscriptions (3h)
- [ ] Add loading states (2h)
- [ ] Add error handling (2h)
- [ ] Write dashboard tests (3h)

**Dependencies**: SUP-303, SUP-305, SUP-307, SUP-401

---

### Story SUP-404: Migrate Help Request Flow to Supabase
**Points**: 13 | **Priority**: P0 | **Owner**: Frontend Dev 1

**As a** user in distress  
**I want** to submit help requests via Supabase  
**So that** responders can help me

**Acceptance Criteria**:
- [ ] Update HelpFormView to use Supabase
- [ ] Update location sharing to Supabase
- [ ] Show real-time help request status
- [ ] Test complete help request flow

**Tasks**:
- [ ] Update HelpFormView.tsx (4h)
- [ ] Update location update logic (2h)
- [ ] Add realtime status updates (3h)
- [ ] Write help request tests (2h)

**Dependencies**: SUP-305, SUP-401

---

### Story SUP-405: Migrate Organization Dashboard to Supabase
**Points**: 13 | **Priority**: P0 | **Owner**: Frontend Dev 2

**As an** institution admin  
**I want** organization dashboard via Supabase  
**So that** I can manage my community

**Acceptance Criteria**:
- [ ] Fetch and update inventory
- [ ] Create/update replenishment requests
- [ ] Update member statuses
- [ ] Post broadcasts
- [ ] Subscribe to realtime updates
- [ ] Test complete org admin flow

**Tasks**:
- [ ] Update OrgDashboardView.tsx (5h)
- [ ] Add inventory management UI (2h)
- [ ] Add request management UI (2h)
- [ ] Add member status UI (2h)
- [ ] Add broadcast UI (1h)
- [ ] Add realtime subscriptions (2h)
- [ ] Write org dashboard tests (3h)

**Dependencies**: SUP-303, SUP-304, SUP-307, SUP-401

---

### Story SUP-406: Implement Offline Support
**Points**: 13 | **Priority**: P1 | **Owner**: Frontend Dev 1

**As a** user  
**I want** offline support  
**So that** I can use the app during emergencies

**Acceptance Criteria**:
- [ ] Queue writes when offline
- [ ] Sync when back online
- [ ] Show offline indicator
- [ ] Handle conflict resolution
- [ ] Test offline → online flow

**Tasks**:
- [ ] Implement offline detection (2h)
- [ ] Create sync queue system (4h)
- [ ] Add offline UI indicator (1h)
- [ ] Implement conflict resolution (4h)
- [ ] Write offline tests (3h)

**Dependencies**: SUP-402, SUP-403, SUP-404, SUP-405

---

### Story SUP-407: Error Handling & Loading States
**Points**: 8 | **Priority**: P1 | **Owner**: Frontend Dev 2

**As a** user  
**I want** clear error messages and loading indicators  
**So that** I understand what's happening

**Acceptance Criteria**:
- [ ] Add loading spinners for all data fetches
- [ ] Add error toasts for failed operations
- [ ] Add retry logic for failed requests
- [ ] Add success confirmations

**Tasks**:
- [ ] Create loading component library (2h)
- [ ] Create error toast system (2h)
- [ ] Add retry logic (2h)
- [ ] Add success notifications (1h)
- [ ] Update all views with error handling (3h)

**Dependencies**: SUP-402, SUP-403, SUP-404, SUP-405

---

## EPIC: MIG-01 - Data Migration & Dual-Write (Phase 3)

**Duration**: Weeks 4-6  
**Owner**: Backend Team  
**Dependencies**: SUP-02  
**Risk**: P0

### Definition of Done
- [ ] Migration script tested on production replica
- [ ] Dual-write system implemented and tested
- [ ] Data validation shows 100% consistency
- [ ] Rollback procedure tested
- [ ] Migration runbook documented

---

### Story MIG-501: Create Migration Script
**Points**: 13 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** backend engineer  
**I want** a migration script  
**So that** we can move data from MongoDB to Supabase

**Acceptance Criteria**:
- [ ] Script migrates all collections to Supabase
- [ ] Script maintains data relationships
- [ ] Script handles large datasets (batching)
- [ ] Script logs progress and errors
- [ ] Script can resume from failure
- [ ] Script validates data after migration
- [ ] Test migration on production replica

**Tasks**:
- [ ] Create migrate-mongodb-to-supabase.js (8h)
- [ ] Add batching logic (2h)
- [ ] Add error handling and logging (2h)
- [ ] Add validation checks (3h)
- [ ] Test on production replica (4h)
- [ ] Document migration script (2h)

**Dependencies**: SUP-02 complete

---

### Story MIG-502: Implement Dual-Write System
**Points**: 13 | **Priority**: P0 | **Owner**: Backend Dev 2

**As a** backend engineer  
**I want** dual-write to MongoDB and Supabase  
**So that** both databases stay in sync during migration

**Acceptance Criteria**:
- [ ] All writes go to both MongoDB and Supabase
- [ ] Supabase write failures don't break MongoDB writes
- [ ] Log discrepancies between databases
- [ ] Feature flag to enable/disable dual-write
- [ ] Metrics dashboard shows sync status

**Tasks**:
- [ ] Create dual-write middleware (4h)
- [ ] Add feature flag system (2h)
- [ ] Implement error handling (2h)
- [ ] Add discrepancy logging (2h)
- [ ] Create sync status dashboard (4h)
- [ ] Write dual-write tests (3h)

**Dependencies**: SUP-02 complete

---

### Story MIG-503: Data Validation & Consistency Checks
**Points**: 8 | **Priority**: P0 | **Owner**: Backend Dev 1

**As a** QA engineer  
**I want** data validation tools  
**So that** I can verify migration accuracy

**Acceptance Criteria**:
- [ ] Compare record counts between databases
- [ ] Compare data checksums
- [ ] Identify missing records
- [ ] Identify data discrepancies
- [ ] Generate validation report

**Tasks**:
- [ ] Create validation script (4h)
- [ ] Implement record count comparison (1h)
- [ ] Implement checksum comparison (2h)
- [ ] Implement discrepancy detection (2h)
- [ ] Generate validation report (2h)

**Dependencies**: MIG-501, MIG-502

---

### Story MIG-504: Test Migration on Staging
**Points**: 8 | **Priority**: P0 | **Owner**: QA Engineer + Backend

**As a** QA engineer  
**I want** to test migration on staging  
**So that** we identify issues before production

**Acceptance Criteria**:
- [ ] Run full migration on staging
- [ ] Validate all data migrated correctly
- [ ] Test application functionality on migrated data
- [ ] Document any issues found
- [ ] Fix all P0 issues

**Tasks**:
- [ ] Set up staging Supabase (1h)
- [ ] Run migration script on staging (2h)
- [ ] Validate data (2h)
- [ ] Test application end-to-end (4h)
- [ ] Document issues and fixes (2h)

**Dependencies**: MIG-501, MIG-503

---

## EPIC: MIG-02 - Cutover & Go-Live (Phase 3)

**Duration**: Weeks 7-8  
**Owner**: Full Team  
**Dependencies**: MIG-01  
**Risk**: P0

### Definition of Done
- [ ] Production migration executed successfully
- [ ] All users transitioned to Supabase
- [ ] MongoDB marked read-only
- [ ] 24-hour monitoring shows no issues
- [ ] Rollback procedure documented and tested
- [ ] Go-live announcement sent

---

### Story MIG-601: Execute Production Migration
**Points**: 13 | **Priority**: P0 | **Owner**: Backend + DevOps

**As a** DevOps engineer  
**I want** to execute production migration  
**So that** we move to Supabase

**Acceptance Criteria**:
- [ ] Announce maintenance window
- [ ] Enable dual-write in production
- [ ] Run migration script
- [ ] Validate data migration
- [ ] Switch traffic to Supabase
- [ ] Mark MongoDB read-only
- [ ] Monitor for 24 hours

**Tasks**:
- [ ] Schedule maintenance window (0.5h)
- [ ] Announce maintenance (0.5h)
- [ ] Enable dual-write (0.5h)
- [ ] Run migration script (4h)
- [ ] Validate migration (2h)
- [ ] Switch DNS/traffic (1h)
- [ ] Set MongoDB read-only (0.5h)
- [ ] Monitor production (8h - spread over 24h)

**Dependencies**: MIG-504

---

### Story MIG-602: Post-Migration Validation
**Points**: 8 | **Priority**: P0 | **Owner**: QA Engineer

**As a** QA engineer  
**I want** to validate production after migration  
**So that** we ensure everything works

**Acceptance Criteria**:
- [ ] All critical flows tested
- [ ] Data validation checks pass
- [ ] Realtime subscriptions working
- [ ] Performance acceptable
- [ ] No errors in logs

**Tasks**:
- [ ] Test authentication flow (1h)
- [ ] Test dashboard views (2h)
- [ ] Test help request flow (1h)
- [ ] Test inventory management (1h)
- [ ] Run data validation (2h)
- [ ] Check error logs (1h)

**Dependencies**: MIG-601

---

### Story MIG-603: Performance Monitoring & Optimization
**Points**: 8 | **Priority**: P1 | **Owner**: Backend + DevOps

**As a** DevOps engineer  
**I want** to monitor performance  
**So that** we catch issues early

**Acceptance Criteria**:
- [ ] Set up performance monitoring
- [ ] Set up error tracking
- [ ] Create alerting rules
- [ ] Monitor for 1 week
- [ ] Document baseline metrics

**Tasks**:
- [ ] Set up Sentry/error tracking (2h)
- [ ] Set up performance monitoring (2h)
- [ ] Configure alert rules (2h)
- [ ] Create monitoring dashboard (2h)
- [ ] Document metrics (1h)

**Dependencies**: MIG-601

---

## EPIC: CLN-01 - Cleanup & Optimization (Phase 3)

**Duration**: Week 8  
**Owner**: Backend Team  
**Dependencies**: MIG-02  
**Risk**: P1

### Definition of Done
- [ ] MongoDB infrastructure decommissioned
- [ ] Old code paths removed
- [ ] Documentation updated
- [ ] Knowledge transfer completed
- [ ] Post-mortem conducted

---

### Story CLN-701: Remove MongoDB Dependencies
**Points**: 8 | **Priority**: P1 | **Owner**: Backend Dev 1

**As a** backend engineer  
**I want** to remove MongoDB code  
**So that** we reduce technical debt

**Acceptance Criteria**:
- [ ] Remove MongoDB models
- [ ] Remove dual-write code
- [ ] Remove feature flags
- [ ] Update dependencies (remove mongoose)
- [ ] Update documentation

**Tasks**:
- [ ] Remove models/ directory (1h)
- [ ] Remove dual-write middleware (1h)
- [ ] Remove feature flags (1h)
- [ ] Remove mongoose dependency (0.5h)
- [ ] Update imports (2h)
- [ ] Update documentation (2h)
- [ ] Test application (2h)

**Dependencies**: MIG-602 (after 1 week of monitoring)

---

### Story CLN-702: Decommission MongoDB Infrastructure
**Points**: 5 | **Priority**: P2 | **Owner**: DevOps

**As a** DevOps engineer  
**I want** to decommission MongoDB  
**So that** we save costs

**Acceptance Criteria**:
- [ ] Create final MongoDB backup
- [ ] Download backup for archival
- [ ] Terminate MongoDB instances
- [ ] Remove MongoDB monitoring
- [ ] Update infrastructure docs

**Tasks**:
- [ ] Create final backup (1h)
- [ ] Download and store backup (1h)
- [ ] Terminate instances (0.5h)
- [ ] Remove monitoring (0.5h)
- [ ] Update docs (1h)

**Dependencies**: CLN-701

---

### Story CLN-703: Update Documentation
**Points**: 5 | **Priority**: P1 | **Owner**: Technical Writer

**As a** developer  
**I want** updated documentation  
**So that** future developers understand the system

**Acceptance Criteria**:
- [ ] Update README
- [ ] Update API documentation
- [ ] Update deployment guide
- [ ] Update architecture diagrams
- [ ] Create Supabase guide

**Tasks**:
- [ ] Update README (1h)
- [ ] Update API docs (2h)
- [ ] Update deployment guide (2h)
- [ ] Update architecture diagrams (2h)
- [ ] Create Supabase integration guide (2h)

**Dependencies**: MIG-602

---

### Story CLN-704: Post-Mortem & Knowledge Transfer
**Points**: 3 | **Priority**: P1 | **Owner**: Tech Lead

**As a** team lead  
**I want** a post-mortem  
**So that** we learn from the migration

**Acceptance Criteria**:
- [ ] Conduct post-mortem meeting
- [ ] Document lessons learned
- [ ] Document what went well
- [ ] Document what to improve
- [ ] Share with stakeholders

**Tasks**:
- [ ] Schedule post-mortem meeting (0.5h)
- [ ] Facilitate meeting (2h)
- [ ] Document findings (2h)
- [ ] Share with team (0.5h)

**Dependencies**: MIG-602

---

## 📊 Dependency Graph

```
Week 1-3:  SEC-01 (Phase 1) ────────────────────────────┐
                                                          │
Week 2-4:  SUP-01 (Infrastructure) ──────────────┐      │
                                                  │      │
Week 3-6:  SUP-02 (Backend Dev) ─────────────────┤      │
                                                  │      │
Week 4-7:  SUP-03 (Frontend) ────────────────────┤      │
                                                  ▼      ▼
Week 4-6:  MIG-01 (Migration & Dual-Write) ───────────────┐
                                                           │
Week 7-8:  MIG-02 (Cutover & Go-Live) ────────────────────┤
                                                           │
Week 8:    CLN-01 (Cleanup) ───────────────────────────────┘
```

---

## 🎯 Sprint Planning

### Sprint 1 (Week 1-2)
**Focus**: Security Fixes + Supabase Setup

**Stories**:
- SEC-101, SEC-102, SEC-103, SEC-104, SEC-105 (25 points)
- SUP-201, SUP-202 (11 points)
- **Total**: 36 points

**Team**:
- Backend Dev 1: SEC-101, SEC-102, SEC-105
- Backend Dev 2: SEC-103, SEC-104
- DevOps: SUP-201, SUP-202 support

---

### Sprint 2 (Week 3-4)
**Focus**: Security Testing + Supabase Backend

**Stories**:
- SEC-106, SEC-107 (13 points)
- SUP-203, SUP-204, SUP-205 (16 points)
- SUP-301, SUP-302 (21 points)
- **Total**: 50 points

**Team**:
- Backend Dev 1: SUP-301, SUP-203
- Backend Dev 2: SUP-302, SUP-204
- DevOps: SEC-107, SUP-205
- QA: SEC-106

---

### Sprint 3 (Week 5-6)
**Focus**: Supabase Backend Complete + Frontend Start

**Stories**:
- SUP-303, SUP-304, SUP-305, SUP-306, SUP-307 (42 points)
- SUP-401, SUP-402 (16 points)
- **Total**: 58 points

**Team**:
- Backend Dev 1: SUP-304, SUP-305
- Backend Dev 2: SUP-303, SUP-306, SUP-307
- Frontend Dev 1: SUP-401, SUP-402

---

### Sprint 4 (Week 7-8)
**Focus**: Frontend Complete + Migration Prep

**Stories**:
- SUP-403, SUP-404, SUP-405 (39 points)
- SUP-406, SUP-407 (21 points)
- MIG-501, MIG-502, MIG-503 (34 points)
- **Total**: 94 points (Large sprint - may need to move some to Sprint 5)

**Team**:
- Frontend Dev 1: SUP-402, SUP-404, SUP-406
- Frontend Dev 2: SUP-403, SUP-405, SUP-407
- Backend Dev 1: MIG-501, MIG-503
- Backend Dev 2: MIG-502

---

### Sprint 5 (Week 9-10)
**Focus**: Migration Testing + Cutover

**Stories**:
- MIG-504 (8 points)
- MIG-601, MIG-602, MIG-603 (29 points)
- **Total**: 37 points

**Team**:
- Full team for migration
- QA: MIG-504, MIG-602
- Backend + DevOps: MIG-601, MIG-603

---

### Sprint 6 (Week 11)
**Focus**: Cleanup & Retrospective

**Stories**:
- CLN-701, CLN-702, CLN-703, CLN-704 (21 points)
- **Total**: 21 points

**Team**:
- Backend: CLN-701
- DevOps: CLN-702
- Tech Writer: CLN-703
- Tech Lead: CLN-704

---

## 🚨 Risk Register

| Risk ID | Description | Probability | Impact | Mitigation | Owner |
|---------|-------------|-------------|--------|------------|-------|
| **R-01** | MongoDB data loss during migration | Low | P0 | Full backup before migration, dual-write system, test on staging | Backend |
| **R-02** | Supabase performance issues at scale | Medium | P1 | Load testing, caching strategy, connection pooling | DevOps |
| **R-03** | RLS policies too restrictive | Medium | P1 | Thorough testing with all user roles, rollback plan | Backend |
| **R-04** | Frontend breaking changes | Medium | P1 | Feature flags, gradual rollout, comprehensive testing | Frontend |
| **R-05** | Auth migration breaks user sessions | High | P0 | User communication, password reset flow, support plan | Full Team |
| **R-06** | Realtime subscriptions overload | Low | P2 | Rate limiting, connection pooling, monitoring | Backend |
| **R-07** | Migration script failure mid-run | Medium | P0 | Idempotent script, resume capability, transaction support | Backend |
| **R-08** | Dual-write sync issues | Medium | P1 | Validation checks, reconciliation script, monitoring | Backend |
| **R-09** | Offline support conflicts | Medium | P2 | Conflict resolution strategy, user education | Frontend |
| **R-10** | Cost overrun on Supabase | Low | P2 | Usage monitoring, alerts, optimization | DevOps |

---

## ✅ Acceptance Criteria Summary

### Phase 1 Complete When:
- [ ] All security vulnerabilities fixed
- [ ] Production deployment successful
- [ ] 24-hour monitoring shows no issues

### Phase 2 Complete When:
- [ ] All Supabase features implemented
- [ ] Frontend fully migrated
- [ ] User acceptance testing passed

### Phase 3 Complete When:
- [ ] Production data migrated
- [ ] MongoDB decommissioned
- [ ] Post-mortem completed

---

**Jira Backlog Version**: 1.0  
**Created**: February 5, 2026  
**Owner**: Technical Program Manager  
**Team Size**: 6 (2 Backend, 2 Frontend, 1 DevOps, 1 QA)  
**Total Duration**: 8-11 weeks
