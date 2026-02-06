# AERA - Emergency Response Application
## Complete Technical Documentation

---

## Table of Contents
1. Project Overview
2. Repository Information
3. Frontend Architecture
4. Backend Architecture
5. Database Schema (MongoDB)
6. API Endpoints
7. Deployment & Hosting
8. Environment Setup
9. Running Locally

---

## 1. Project Overview

**AERA** is an AI-powered emergency response coordination application that connects individuals, organizations (churches, NGOs), first responders, and authorities during disasters.

**Key Features:**
- Real-time emergency reporting with AI-assisted triage
- Community hub coordination (member status tracking)
- Inventory management and replenishment requests
- Broadcasting system for emergency alerts
- Mobile-first responsive design
- Offline-first local storage with cloud sync
- Role-based access control

**Tech Stack:**
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Express.js, MongoDB, Mongoose, JWT Auth, bcryptjs
- **Deployment**: GitHub Pages (frontend), Render (backend + MongoDB)

---

## 2. Repository Information

### Main Repositories

| Repo | URL | Purpose |
|------|-----|---------|
| **Aeratest** | https://github.com/Lavender333/Aeratest | Primary deployment repo (GitHub Pages) |
| **Aeraapp** | https://github.com/Lavender333/Aeraapp | Original source repository |

### Deployment URLs

| Service | URL |
|---------|-----|
| **Live App (GitHub Pages)** | https://lavender333.github.io/Aeratest |
| **Backend Server (Dev)** | http://localhost:4000 |
| **Frontend Dev Server** | http://localhost:3000 |

---

## 3. Frontend Architecture

### Directory Structure
```
├── components/               # Reusable UI Components
│   ├── BottomNav.tsx        # Navigation bar
│   ├── Button.tsx           # Button component
│   ├── Card.tsx             # Card wrapper
│   ├── HouseholdManager.tsx # Family member management
│   ├── Input.tsx            # Form inputs
│   ├── ProgressBar.tsx      # Progress indicator
│   └── SignaturePad.tsx     # Digital signature capture
│
├── views/                    # Page-level components
│   ├── SplashView.tsx       # Landing page
│   ├── LoginView.tsx        # Authentication
│   ├── RegistrationView.tsx # User onboarding
│   ├── DashboardView.tsx    # Main dashboard
│   ├── HelpFormView.tsx     # Emergency help form
│   ├── MapView.tsx          # Resource location map
│   ├── AlertsView.tsx       # Emergency alerts
│   ├── SettingsView.tsx     # User & admin settings
│   ├── OrgDashboardView.tsx # Organization hub dashboard
│   └── [Other Views]        # Logistics, Recovery, Drone, etc.
│
├── services/                 # Business logic & API
│   ├── storage.ts           # LocalStorage wrapper + mock data
│   ├── api.ts               # Backend API client
│   ├── translations.ts      # i18n support
│   ├── validation.ts        # Input validation
│   ├── inventoryStatus.ts   # Inventory helpers
│   └── mockGenAI.ts         # AI triage mock
│
├── models/                   # Backend models (Node.js/Express)
│   ├── user.js              # User schema
│   ├── inventory.js         # Organization inventory
│   ├── request.js           # Supply requests
│   ├── member.js            # Community members
│   ├── memberStatus.js      # Member safety status
│   ├── broadcast.js         # Emergency broadcasts
│   └── helpRequest.js       # SOS/help requests
│
├── App.tsx                   # Root component with routing
├── index.tsx                # React entry point
├── types.ts                 # TypeScript interfaces
└── vite.config.ts           # Vite build config
```

### Key Views & Features

| View | Purpose | Key Features |
|------|---------|--------------|
| **DashboardView** | Main user hub | Status tracking, resource alerts, broadcasts, analytics |
| **HelpFormView** | Emergency reporting | Quick triage, location sharing, priority levels |
| **OrgDashboardView** | Organization admin hub | Member tracking, inventory management, broadcasting |
| **MapView** | Resource discovery | Google Maps integration, live location data |
| **AlertsView** | Emergency intelligence | System broadcasts, news scanning, verification |
| **SettingsView** | Admin console | User management, access control, organization directory |
| **LogisticsView** | Supply chain | Replenishment requests, delivery tracking |

### State Management
- **React Hooks** for component state
- **LocalStorage** (StorageService) for persistence
- **Session State** for real-time updates

---

## 4. Backend Architecture

### Express.js Server Structure

**File**: `server.js` (315 lines)

**Port**: 4000 (default) or `$PORT` env variable

**Core Modules**:
- CORS for cross-origin requests
- JWT authentication with 7-day expiration
- Mongoose for MongoDB ORM
- bcryptjs for password hashing

### Authentication Flow
```
POST /api/auth/register
  ↓ Hash password with bcrypt
  ↓ Create User document
  ↓ Return JWT token
  
POST /api/auth/login
  ↓ Find User by email/phone
  ↓ Compare password hash
  ↓ Sign new JWT token
  
POST /api/auth/forgot / POST /api/auth/reset
  ↓ Generate reset token (15 min expiry)
  ↓ Update user, send via email (or return for demo)
```

### Environment Variables Required
```
MONGODB_URI=mongodb+srv://...
MONGODB_DB=aeraapp
JWT_SECRET=your-secret-key
FRONTEND_ORIGIN=https://your-frontend.com
PORT=4000
```

---

## 5. Database Schema (MongoDB)

### Collections Overview

#### **1. User Collection**
```javascript
{
  _id: ObjectId,
  email: String (unique, indexed),
  phone: String (indexed),
  passwordHash: String,
  role: String (enum: ADMIN, CONTRACTOR, LOCAL_AUTHORITY, FIRST_RESPONDER, GENERAL_USER, INSTITUTION_ADMIN),
  orgId: String (indexed),
  fullName: String,
  resetToken: String,
  resetTokenExpiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### **2. Inventory Collection**
```javascript
{
  _id: ObjectId,
  orgId: String (unique, indexed),
  water: Number,
  food: Number,
  blankets: Number,
  medicalKits: Number,
  createdAt: Date,
  updatedAt: Date
}
```

#### **3. Request Collection** (Replenishment)
```javascript
{
  _id: ObjectId,
  orgId: String (indexed),
  orgName: String,
  item: String (Water, Food, Blankets, Med Kits),
  quantity: Number,
  status: String (enum: PENDING, FULFILLED, STOCKED),
  provider: String,
  deliveredQuantity: Number,
  createdAt: Date,
  updatedAt: Date
}
```

#### **4. MemberStatus Collection**
```javascript
{
  _id: ObjectId,
  orgId: String (indexed),
  memberId: String,
  name: String,
  status: String (enum: SAFE, DANGER, UNKNOWN),
  createdAt: Date,
  updatedAt: Date,
  Indexes: { orgId: 1, memberId: 1 } (unique)
}
```

#### **5. Broadcast Collection**
```javascript
{
  _id: ObjectId,
  orgId: String (unique, indexed),
  message: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### **6. HelpRequest Collection** (SOS)
```javascript
{
  _id: ObjectId,
  orgId: String (indexed),
  userId: String (indexed),
  data: Object,
  status: String (enum: PENDING, RECEIVED, DISPATCHED, RESOLVED),
  priority: String (enum: LOW, MEDIUM, HIGH, CRITICAL),
  location: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### **7. Member Collection** (Organization Members)
```javascript
{
  _id: ObjectId,
  orgId: String (indexed),
  name: String,
  status: String (enum: SAFE, DANGER, UNKNOWN),
  location: String,
  lastUpdate: String,
  needs: [String],
  phone: String,
  address: String,
  emergencyContactName: String,
  emergencyContactPhone: String,
  emergencyContactRelation: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 6. API Endpoints

### Authentication Endpoints
```
POST   /api/auth/register              Register new user
POST   /api/auth/login                 Login with email/phone + password
POST   /api/auth/forgot                Request password reset
POST   /api/auth/reset                 Reset password with token
GET    /api/health                     Health check
```

### Inventory Endpoints
```
GET    /api/orgs/:orgId/inventory      Get org inventory
POST   /api/orgs/:orgId/inventory      Update org inventory
```

### Replenishment Request Endpoints
```
GET    /api/orgs/:orgId/requests       List all requests for org
POST   /api/orgs/:orgId/requests       Create new request
POST   /api/requests/:id/status        Update request status & delivery qty
```

### Member Status Endpoints
```
GET    /api/orgs/:orgId/status         Get all member statuses + counts
POST   /api/orgs/:orgId/status         Update member status (SAFE/DANGER/UNKNOWN)
```

### Broadcast Endpoints
```
GET    /api/orgs/:orgId/broadcast      Get org broadcast message
POST   /api/orgs/:orgId/broadcast      Post new broadcast message
```

### Help Request Endpoints
```
GET    /api/orgs/:orgId/help           Get all help requests for org
GET    /api/users/:userId/help/active  Get active SOS for user
POST   /api/users/:userId/help         Submit new help request
POST   /api/help/:id/location          Update help request location
```

### Member CRUD Endpoints
```
GET    /api/orgs/:orgId/members        List all members for org
POST   /api/orgs/:orgId/members        Create new member
PUT    /api/orgs/:orgId/members/:id    Update member info
DELETE /api/orgs/:orgId/members/:id    Delete member
```

---

## 7. Deployment & Hosting

### Frontend Deployment (GitHub Pages)

**Current Configuration**:
- Hosted on: https://lavender333.github.io/Aeratest
- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Build command: `npm run build` → outputs to `dist/`
- Deployment: Copies `dist` → `docs` folder → commits & pushes

**Base Path**: `/Aeratest/` (for subdirectory deployment)

**GitHub Actions**:
- Triggers on: Push to `main` branch
- Permissions: Contents write (for pushing docs folder)
- Runs on: Ubuntu latest
- Node version: 18

### Backend Deployment Options

#### Option 1: Render.io (Free Tier)
See `render.yaml` configuration:
```yaml
services:
  - name: aera-api (Node.js web service)
    buildCommand: npm install
    startCommand: npm run server
    Environment: MongoDB URI, JWT Secret
    
  - name: aera-frontend (Static files)
    buildCommand: npm run build
    Static path: dist/
```

#### Option 2: Local Development
```bash
npm run server    # Starts on port 4000
npm run dev       # Frontend on port 3000
```

---

## 8. Environment Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MongoDB (local or cloud: MongoDB Atlas)
- Git

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/Lavender333/Aeratest.git
cd "Aeratest"

# 2. Install dependencies
npm install

# 3. Set up environment variables
cat > .env.local << EOF
VITE_API_URL=http://localhost:4000
GEMINI_API_KEY=your-google-api-key
EOF

cat > .env << EOF
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DB=aeraapp
JWT_SECRET=your-jwt-secret
FRONTEND_ORIGIN=http://localhost:3000
PORT=4000
EOF

# 4. Start development servers
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend (optional, for API testing)
npm run server
```

---

## 9. Running Locally

### Quick Start (Frontend Only - with Mock Data)
```bash
npm run dev
# Opens: http://localhost:3000
# Uses: LocalStorage (no backend required)
```

### Full Stack (Frontend + Backend + MongoDB)
```bash
# Terminal 1: Backend Server
npm run server
# Expects: MONGODB_URI environment variable
# Runs on: http://localhost:4000

# Terminal 2: Frontend
VITE_API_URL=http://localhost:4000 npm run dev
# Runs on: http://localhost:3000
# Connects to: Backend API
```

### Production Build
```bash
npm run build
# Output: dist/ folder
# Ready for deployment to GitHub Pages or static hosting
```

---

## Demo Accounts (Mock Data)

**User Accounts**:
| Name | Phone | Role | Community |
|------|-------|------|-----------|
| John Smith | 555-1001 | GENERAL_USER | CH-9921 |
| David Brown | 555-1002 | GENERAL_USER | CH-9921 |
| Pastor John | 555-0101 | INSTITUTION_ADMIN | CH-9921 |
| Sarah Connor | 555-9111 | FIRST_RESPONDER | - |

**Organization**: Grace Community Church (CH-9921)

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         FRONTEND (React 19)              │
│  - DashboardView, HelpFormView, etc.    │
│  - Tailwind CSS + Lucide Icons          │
│  - LocalStorage (offline-first)         │
└────────────┬────────────────────────────┘
             │ HTTP/HTTPS
             │ (VITE_API_URL)
             ▼
┌─────────────────────────────────────────┐
│    BACKEND (Express.js + JWT)           │
│  - Auth, Inventory, Requests            │
│  - Member Status, Broadcasts, Help      │
│  - CORS, Password Hashing               │
└────────────┬────────────────────────────┘
             │ Mongoose ORM
             ▼
┌─────────────────────────────────────────┐
│     MongoDB (Cloud or Local)            │
│  - User, Inventory, Request             │
│  - MemberStatus, Broadcast              │
│  - HelpRequest, Member                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│     DEPLOYMENT TARGETS                  │
│  ┌─ GitHub Pages (Frontend)             │
│  │  https://lavender333.github.io/...   │
│  ├─ Render.io (Backend)                 │
│  │  https://aera-api.onrender.com       │
│  └─ MongoDB Atlas (Database)            │
│     mongodb+srv://...                   │
└─────────────────────────────────────────┘
```

---

## Key Features Summary

✅ **Real-time Emergency Reporting** - Priority-based SOS system with location tracking
✅ **Community Coordination** - Churches/NGOs as digital hubs for member status
✅ **Inventory Management** - Track & request supplies (water, food, blankets, medical)
✅ **Broadcasting** - Organization-wide alerts and messaging
✅ **Access Control** - 6 role types with granular permissions
✅ **Offline-First** - Works offline, syncs when online
✅ **Mobile Responsive** - Optimized for emergency responders
✅ **AI-Assisted Triage** - Google Gemini integration for help assessment
✅ **Multi-Language** - Internationalization support

---

## Links & Resources

- **GitHub Repos**: 
  - Aeratest: https://github.com/Lavender333/Aeratest
  - Aeraapp: https://github.com/Lavender333/Aeraapp
- **Live App**: https://lavender333.github.io/Aeratest
- **Documentation**: This file + README.md in repo

---

**Last Updated**: January 21, 2026
**Version**: 1.0
**Status**: Production Ready (GitHub Pages), Backend Disconnected (Local Storage Fallback)
