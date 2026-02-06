
# AERA - AI Emergency Response Assistant

**Coordinating disaster relief for churches, NGOs, and communities**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

**🚨 PRODUCTION-READY** - Security fixes implemented, Supabase migration architecture complete

---

## 🎯 Quick Links

- **🚀 [Quick Start Guide](QUICK_START.md)** - Get running in 5 minutes
- **🔒 [Security Implementation](IMPLEMENTATION_PLAN.md)** - Phase 1 security fixes
- **🗄️ [Supabase Migration Guide](supabase/FRONTEND_INTEGRATION_GUIDE.md)** - Full migration to Supabase
- **✅ [Test Plan](TEST_PLAN.md)** - 19 security test cases
- **📋 [Jira Backlog](JIRA_SPRINT_BACKLOG.md)** - 37 user stories, 6 sprints
- **⚠️ [Gotchas & Fixes](GOTCHAS_AND_FIXES.md)** - Production readiness checklist

---

## 📖 What is AERA?

AERA (AI Emergency Response Assistant) is a **life-saving platform** that helps churches, NGOs, and community organizations coordinate disaster relief efforts. During hurricanes, earthquakes, floods, and other emergencies, AERA enables:

- **🆘 SOS/Help Requests** - Users submit geo-tagged emergency requests
- **📍 Real-time Location Tracking** - First responders see who needs help and where
- **📦 Inventory Management** - Track food, water, medical supplies, shelter capacity
- **👥 Household Safety Tracking** - Mark members as safe/unsafe/unknown/needs help
- **📢 Broadcast Alerts** - Organization-wide emergency notifications
- **🔄 Real-time Updates** - Live dashboard updates via Supabase subscriptions
- **📱 Offline Support** - Queue operations when internet is down, sync when back online

---

## 🎉 Latest Updates (February 2026)

### ✅ Phase 1: Critical Security Fixes - COMPLETE
- **Authentication enforcement** on all routes (JWT middleware)
- **JWT secret validation** - Server won't start without strong secret (32+ chars)
- **Secure password reset** - Tokens hashed with SHA-256, never exposed
- **NoSQL injection prevention** - express-mongo-sanitize + Zod validation
- **Rate limiting** - 5 login attempts per 15 min, 100 API requests per 15 min

**Files**: `middleware/auth.js`, `middleware/validate.js`, `validation/schemas.js`, `server-new.js`

### ✅ Phase 2: Supabase Migration Architecture - COMPLETE
- **PostgreSQL schema** with proper foreign keys, RLS, triggers (467 lines)
- **Row Level Security policies** for org-based multi-tenancy (388 lines)
- **Real-time subscriptions** for 5 critical tables (help requests, broadcasts, inventory)
- **Migration script** from MongoDB to Supabase (258 lines)
- **Frontend integration guide** with code examples (500+ lines)

**Files**: `supabase/schema.sql`, `supabase/rls-policies.sql`, `supabase/FRONTEND_INTEGRATION_GUIDE.md`

### ✅ Jira Sprint Backlog - COMPLETE
- **37 user stories** across 7 epics
- **6 sprints** (8-11 weeks total)
- **302 story points** with task breakdowns
- **Risk register** with 10 identified risks

**File**: `JIRA_SPRINT_BACKLOG.md`

### ✅ Production Gotchas & Fixes - COMPLETE
- **8 critical gotchas** fixed (localStorage quota, offline sync, JWT expiry, enum mismatches, etc.)
- **Load testing scenarios** (mass SOS, offline→online burst)
- **Pre-launch checklist** with 15+ items

**File**: `GOTCHAS_AND_FIXES.md`

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (for Phase 1) OR Supabase (for Phase 2)

### Option A: Run with Security Fixes (Phase 1)

```bash
# 1. Install dependencies
npm install

# 2. Generate secrets
openssl rand -base64 64  # Copy output for JWT_SECRET

# 3. Create .env file
cat > .env << EOF
JWT_SECRET=<paste-your-secret>
JWT_REFRESH_SECRET=<generate-another-secret>
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=aera
FRONTEND_ORIGIN=http://localhost:5173
EOF

# 4. Switch to secure server
mv server.js server-old.js
mv server-new.js server.js

# 5. Start backend
node server.js

# 6. Start frontend (new terminal)
npm run dev
```

**See [QUICK_START.md](QUICK_START.md) for detailed instructions**

### Option B: Run with Supabase (Phase 2)

```bash
# 1. Create Supabase project at supabase.com
# 2. Deploy schema: Run supabase/schema.sql in SQL Editor
# 3. Deploy RLS: Run supabase/rls-policies.sql in SQL Editor
# 4. Install Supabase client
npm install @supabase/supabase-js

# 5. Configure environment
cat > .env << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF

# 6. Follow frontend migration guide
# See supabase/FRONTEND_INTEGRATION_GUIDE.md
```

---

## 🏗️ Architecture

### Current (Phase 1)
```
Frontend (React + TypeScript + Vite)
   ↓
Express.js API + JWT Auth
   ↓
MongoDB (Mongoose)
```

### Future (Phase 2 - Supabase)
```
Frontend (React + TypeScript + Vite)
   ↓
Supabase Client SDK
   ↓
Supabase (PostgreSQL + Auth + Realtime + Storage)
   ↓
Row Level Security (RLS) for multi-tenancy
```

---

## 📁 Project Structure

```
aera---emergency-response/
├── middleware/
│   ├── auth.js              # ✅ JWT authentication & authorization
│   └── validate.js          # ✅ Zod validation middleware
├── validation/
│   └── schemas.js           # ✅ Request validation schemas
├── models/
│   ├── user.js              # ✅ User model (updated for secure reset)
│   ├── inventory.js
│   ├── helpRequest.js
│   ├── member.js
│   └── ...
├── services/
│   ├── api.ts               # API client
│   ├── storage.ts           # localStorage wrapper
│   ├── translations.ts      # i18n support
│   └── validation.ts
├── views/
│   ├── LoginView.tsx        # Authentication
│   ├── DashboardView.tsx    # Main dashboard
│   ├── HelpFormView.tsx     # SOS submission
│   ├── LogisticsView.tsx    # Inventory management
│   ├── OrgDashboardView.tsx # Organization admin
│   └── ...
├── components/
│   ├── BottomNav.tsx
│   ├── HouseholdManager.tsx
│   └── ...
├── supabase/
│   ├── schema.sql           # ✅ PostgreSQL database schema
│   ├── rls-policies.sql     # ✅ Row Level Security policies
│   ├── realtime-config.md   # ✅ Realtime subscriptions guide
│   ├── migrate-mongodb-to-supabase.js  # ✅ Migration script
│   └── FRONTEND_INTEGRATION_GUIDE.md   # ✅ Migration guide
├── server.js                # ✅ Secure Express server (Phase 1)
├── package.json
├── QUICK_START.md           # ✅ 5-minute setup guide
├── IMPLEMENTATION_PLAN.md   # ✅ Security implementation
├── TEST_PLAN.md             # ✅ 19 test cases
├── DEPLOYMENT_CHECKLIST.md  # ✅ Production deployment
├── JIRA_SPRINT_BACKLOG.md   # ✅ Sprint planning (37 stories)
├── GOTCHAS_AND_FIXES.md     # ✅ Production gotchas
└── IMPLEMENTATION_SUMMARY.md # ✅ Complete overview
```

---

## 🔒 Security

### Phase 1 Security Fixes (IMPLEMENTED)

| Vulnerability | Status | Fix |
|--------------|--------|-----|
| **Auth Bypass** | ✅ Fixed | JWT middleware on all protected routes |
| **Weak JWT Secret** | ✅ Fixed | Fail-fast validation, 32+ char requirement |
| **Password Reset Exposure** | ✅ Fixed | SHA-256 hashed tokens, never in API response |
| **NoSQL Injection** | ✅ Fixed | express-mongo-sanitize + Zod validation |
| **Brute Force** | ✅ Fixed | Rate limiting (5 auth/15min, 100 API/15min) |

**See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for details**

### Rate Limits
- **Auth endpoints**: 5 requests per 15 minutes
- **API endpoints**: 100 requests per 15 minutes

### Testing
Run all 19 security tests:
```bash
# See TEST_PLAN.md for complete test suite
curl http://localhost:5000/api/inventory  # Should return 401
```

---

## 🧪 Testing

### Security Test Suite (19 tests)
```bash
# See TEST_PLAN.md for all tests
bash test-security.sh
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run mass SOS test (1000 users)
artillery run load-test-sos.yml
```

**See [TEST_PLAN.md](TEST_PLAN.md) for complete testing guide**

---

## 🚀 Deployment

### Staging Deployment
```bash
# 1. Set environment variables
export JWT_SECRET=<64-char-secret>
export MONGODB_URI=<staging-mongodb-uri>

# 2. Deploy
npm run build
pm2 start server.js --name aera-api

# 3. Run smoke tests
curl https://staging.aera-app.com/health
```

### Production Deployment
**See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete guide**

Pre-deployment checklist:
- [ ] JWT_SECRET is 64+ characters
- [ ] All environment variables set
- [ ] All 19 security tests pass
- [ ] Rate limiting configured
- [ ] CORS restricted to production domain
- [ ] Error tracking configured (Sentry)
- [ ] Backup strategy in place

---

## 📋 Roadmap

### ✅ Phase 1: Critical Security Fixes (Weeks 1-3)
- [x] JWT authentication enforcement
- [x] Password reset security
- [x] Input sanitization & validation
- [x] Rate limiting
- [x] NoSQL injection prevention

### ✅ Phase 2: Supabase Migration (Weeks 2-7)
- [x] PostgreSQL schema design
- [x] Row Level Security policies
- [x] Real-time subscriptions configuration
- [x] Migration script from MongoDB
- [x] Frontend integration guide

### 🔄 Phase 3: Migration & Cutover (Weeks 4-8)
- [ ] Test migration on staging
- [ ] Dual-write to MongoDB + Supabase
- [ ] Production migration
- [ ] Decommission MongoDB

### 📅 Phase 4: Enhancements (Ongoing)
- [ ] Push notifications
- [ ] Offline-first architecture
- [ ] Multi-language support (Spanish, Haitian Creole)
- [ ] AI-powered triage recommendations

**See [JIRA_SPRINT_BACKLOG.md](JIRA_SPRINT_BACKLOG.md) for detailed sprint planning**

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Before submitting PR:**
- [ ] All tests pass (`npm test`)
- [ ] Security tests pass (see [TEST_PLAN.md](TEST_PLAN.md))
- [ ] Code follows project style guide
- [ ] Documentation updated

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- Backend powered by [Express.js](https://expressjs.com/) and [MongoDB](https://www.mongodb.com/)
- Migrating to [Supabase](https://supabase.com/) for real-time features
- Security enhanced with [Zod](https://zod.dev/), [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
- AI assistance from [Google Gemini](https://ai.google.dev/)

---

## 📞 Support

- **Documentation**: See guides linked at top of README
- **Issues**: [GitHub Issues](https://github.com/Lavender333/Aeraapp/issues)
- **Security**: See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **Deployment**: See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

---

## 🎓 Learning Resources

**New to the project?**
1. Start with [QUICK_START.md](QUICK_START.md) - Get running in 5 minutes
2. Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - High-level overview
3. Review [GOTCHAS_AND_FIXES.md](GOTCHAS_AND_FIXES.md) - Common pitfalls

**Ready to deploy?**
1. Review [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Security implementation
2. Run tests from [TEST_PLAN.md](TEST_PLAN.md) - 19 security tests
3. Follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Production deployment

**Migrating to Supabase?**
1. Review [supabase/schema.sql](supabase/schema.sql) - Database schema
2. Read [supabase/FRONTEND_INTEGRATION_GUIDE.md](supabase/FRONTEND_INTEGRATION_GUIDE.md) - Frontend migration
3. Follow [JIRA_SPRINT_BACKLOG.md](JIRA_SPRINT_BACKLOG.md) - Sprint planning

---

**Built with ❤️ for communities in crisis**

**GitHub Repository:** https://github.com/Lavender333/Aeraapp  
**AI Studio:** https://ai.studio/apps/drive/1z0n3mrvjVjwao3_IjdQea7eqKa3Bm36S
