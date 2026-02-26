# AERA Role Manual: Org Admin (Single + Network)

Primary Accounts:
- `pastor@example.com` / `AeraDemo!2026` (single-location)
- `ng1001.orgadmin@aera.demo` / `AeraDemo!2026` (network)

## 1) Role Purpose

Org Admins run preparedness and incident operations either for one location or for a parent network with multiple child locations.

## 2) Role Modes in This Manual

- **Single-location mode (`INSTITUTION_ADMIN`)**: one church/community node
- **Network mode (`ORG_ADMIN`)**: parent + child location coordination

Use this single manual for both modes.

## 3) Before You Start (Trainer Setup)

1. Launch app (`npm run dev`).
2. Log in first as `pastor@example.com` and confirm single-site context (`CH-9921`).
3. Log out, then log in as `ng1001.orgadmin@aera.demo` and confirm parent context (`NG-1001`) with child nodes (`CH-9921`, `NGO-5500`).
4. Confirm trainee can reach: Overview, Members, Preparedness, Inventory, and Broadcast-related screens.

**Pass condition:** trainee can switch account context and open required views without prompts.

## 4) Hands-On Workflow (Step-by-Step)

### Situation A: Daily Readiness (No Active Event)

#### Single-location steps

1. Sign in as `pastor@example.com`.
2. Open org overview and review top-line readiness indicators.
3. Identify:
	- unknown/unreached members
	- transport-limited households
	- highest medical vulnerability concentration
4. Record top 3 same-day follow-up households.

#### Network steps

1. Sign in as `ng1001.orgadmin@aera.demo`.
2. Open parent rollup (`NG-1001`).
3. Identify which child has:
	- most unknown status records
	- greatest vulnerability burden
	- weakest readiness completion
4. Switch into each child and validate those findings.

**Pass condition:** trainee presents a clear risk-ranked priority list.

### Situation B: Pre-Impact Warning (T-72 to T-24)

#### Single-location steps

1. Open Members tab and mark high-risk households (medical + mobility + transport).
2. Open Preparedness tab and rank outreach:
	- Priority 1: life-sustaining medical dependency
	- Priority 2: no transportation access
	- Priority 3: incomplete contact profile
3. Build first outreach wave with action owner + deadline.

#### Network steps

1. Switch between `CH-9921` and `NGO-5500`.
2. Compare whether constraints are same-type or different-type.
3. Decide support order and justify why one location is first.
4. Prepare one network-wide baseline directive and one targeted child directive.

**Pass condition:** prioritization is evidence-based and time-bound.

### Situation C: Impact Operations

#### Single-location steps

1. Open live operational views and monitor incoming status updates.
2. Check inventory constraints likely to fail inside 24 hours.
3. Send local directive including:
	- who must act
	- what action is required
	- by when
	- where to report updates
4. Re-prioritize outreach based on new impact signals.

#### Network steps

1. Send one network baseline directive.
2. Send one location-specific directive to highest-risk child.
3. Monitor if communication strategy matches local constraints.
4. Re-target follow-up directives where execution quality lags.

**Pass condition:** directives are targeted, actionable, and result in improved alignment.

### Situation D: Recovery Oversight (+24 to +72)

#### Single-location steps

1. Recheck unresolved households.
2. Classify each as:
	- resolved
	- in progress
	- blocked/escalation needed
3. Publish a short local recovery brief with blockers + next checkpoint.

#### Network steps

1. Re-open parent rollup and compare recovery velocity by location.
2. Classify each child location as:
	- stable
	- delayed
	- blocked
3. Publish multi-location command brief:
	- where help is most needed
	- what support type is needed
	- next review checkpoint time

**Pass condition:** no critical case or location remains unowned.

## 5) Common Mistakes to Prevent

- Sending generic messages when conditions differ by location
- Prioritizing by volume instead of life-safety risk
- Skipping parent/child context validation before directives
- Leaving unresolved critical households without owner and deadline

## 6) Troubleshooting During Training

- If views look inconsistent, refresh and confirm active account/role context.
- If network child switching fails, verify org hierarchy is seeded correctly.
- If expected admin screens are blocked, verify role (`INSTITUTION_ADMIN` or `ORG_ADMIN`).
- If login fails, rerun account seeds from the capture runbook and retry.

## 7) Readiness Check (Final)

Trainee passes when they can:

- Operate both single-location and network contexts correctly
- Prioritize households/locations by risk and constraints
- Issue precise, targeted broadcasts with deadlines
- Deliver concise impact and recovery command briefs
