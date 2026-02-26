# AERA Role Manual: Platform Admin

Role: `ADMIN`

## 1) Role Purpose

Platform Admins maintain system-level operational health, role governance, and cross-tenant support readiness.

## 2) Core Responsibilities

- Manage platform-wide access and role boundaries
- Oversee admin-only operational views and approvals
- Support incident-time data integrity and uptime practices
- Enforce audit discipline and process consistency

## 3) Hands-On Workflow

### Step A: Access and Role Governance

1. Confirm role assignment correctness
2. Validate restricted-view access boundaries
3. Check for privilege drift and correct immediately

**Pass condition:** no user has mismatched privilege exposure.

### Step B: Platform Operations During Incident

1. Monitor platform health and critical view availability
2. Resolve blockers impacting county/state/org workflows
3. Communicate mitigations and expected recovery times

**Pass condition:** high-impact blockers are triaged and tracked.

### Step C: Audit and Post-Incident Controls

1. Review role and access changes during incident window
2. Record governance exceptions and justification
3. Publish post-incident platform readiness actions

**Pass condition:** governance trail is complete and reviewable.

## 4) Common Mistakes to Prevent

- Granting temporary elevated access without expiry controls
- Delaying cross-role incident communication
- Failing to capture admin actions for audit review

## 5) Training Completion Check

Platform Admin passes when they can:

- Demonstrate least-privilege enforcement
- Keep critical workflows unblocked under pressure
- Produce clean audit-ready operational records
