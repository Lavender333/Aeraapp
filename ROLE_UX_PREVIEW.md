# Role UX Preview — What Users Will See (Concept Only)

> This is a visual/text preview of role‑based screens before any code changes.

---

## ADMIN — Command Center

### What the user sees (top of dashboard)
- A **Command Center** header with live **critical alerts**, **approvals**, and **system health** tiles.
- A **triage feed** (latest incidents) and a **map panel** side‑by‑side.

```
┌────────────────────────────────────────────────────────────────────────┐
│ COMMAND CENTER                                                         │
├────────────────────────────────────────────────────────────────────────┤
│ [CRITICAL ALERTS] [PENDING APPROVALS] [SYSTEM HEALTH]                   │
│  • 3 Critical ▸ Open                                                   │
│  • 7 Approvals ▸ Review                                                │
│  • Sync: OK | Latency: 120ms                                           │
├────────────────────────────────────────────────────────────────────────┤
│ INCIDENT TRIAGE (Map + Feed)                                           │
│  • Live incidents with severity + owner + SLA                          │
│  • One‑tap dispatch / escalate / assign                                │
├────────────────────────────────────────────────────────────────────────┤
│ OPERATIONS                                                             │
│  [Access Control] [Broadcasts] [Inventory] [Drone Ops] [Audit Log]      │
└────────────────────────────────────────────────────────────────────────┘
```

### Immediate vs. one‑tap vs. buried
- **Immediate:** critical alerts, approvals, system health, triage.
- **One‑tap:** access control, audit log, drone ops.
- **Buried:** cosmetic settings.

---

## INSTITUTION_ADMIN — Hub Operations

### What the user sees (top of dashboard)
- A **Hub Operations** header with **inventory**, **member safety**, and **broadcast** panels.
- A **Member Directory** block with search + filters.

```
┌────────────────────────────────────────────────────────────────────────┐
│ HUB OPERATIONS                                                         │
├────────────────────────────────────────────────────────────────────────┤
│ [INVENTORY STATUS] [MEMBER SAFETY] [BROADCASTS]                        │
│  Water: MED | Food: LOW | Med: OK                                       │
│  27 SAFE | 3 UNKNOWN                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ MEMBER DIRECTORY                                                       │
│  Search ▸ Filters ▸ Recent Check‑ins                                    │
├────────────────────────────────────────────────────────────────────────┤
│ REPLENISHMENT REQUESTS                                                 │
│  Pending ▸ Approve ▸ Track Delivery                                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Immediate vs. one‑tap vs. buried
- **Immediate:** inventory, member safety, broadcast composer.
- **One‑tap:** directory, request queue, hub audit log.
- **Buried:** global analytics.

---

## GENERAL_USER — Safety First

### What the user sees (top of dashboard)
- A **Safety First** layout with two large actions: **Get Help** and **I’m Safe**.
- A **Community Connection** panel and **Updates** panel below.

```
┌────────────────────────────────────────────────────────────────────────┐
│ SAFETY FIRST                                                           │
├────────────────────────────────────────────────────────────────────────┤
│ [GET HELP] [I’M SAFE]                                                   │
│  Big primary actions                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ COMMUNITY                                                              │
│  Connect / Update Community ID                                          │
├────────────────────────────────────────────────────────────────────────┤
│ UPDATES                                                                │
│  Broadcasts ▸ Resource Depot ▸ Status                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Immediate vs. one‑tap vs. buried
- **Immediate:** SOS, safety check‑in.
- **One‑tap:** community connect, updates, settings.
- **Buried:** admin‑only features.

---

## FIRST_RESPONDER — Action Feed + Map

### What the user sees (top of dashboard)
- A **Responder Feed** with **live map**, **incident feed**, and **routing** tabs.
- **One‑tap actions** for rapid updates.

```
┌────────────────────────────────────────────────────────────────────────┐
│ RESPONDER FEED                                                         │
├────────────────────────────────────────────────────────────────────────┤
│ [LIVE MAP]  [INCIDENT FEED]  [ROUTES]                                   │
│  • Critical ▸ 0.8 mi ▸ Start Route                                     │
│  • High ▸ 1.4 mi ▸ Assign                                               │
├────────────────────────────────────────────────────────────────────────┤
│ ONE‑TAP ACTIONS                                                        │
│  [Update Status] [Request Backup] [Notify Hospital]                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Immediate vs. one‑tap vs. buried
- **Immediate:** map + live feed + routing.
- **One‑tap:** status updates, dispatch actions.
- **Buried:** any non‑operational modules.

---

## Permission‑Aware UX (All Roles)

### What the user sees
- Locked modules display **“Why locked”** + **“Request access”** instead of hard errors.
- High‑risk actions show **severity‑based confirmations**.
- Every sensitive screen includes an **Audit Trail** link.

If you want this rendered as clickable prototypes or implemented in code, say the word.
