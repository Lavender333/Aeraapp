# AERA Quick Start Guide

## 🚀 Getting Started in 5 Minutes

This guide gets you from zero to a secure, running AERA instance.

---

## Option A: Deploy Security Fixes Only (Phase 1)

**Use this if**: You want to secure the existing MongoDB/Express setup NOW

### Step 1: Install Dependencies (1 minute)

```bash
npm install jsonwebtoken@^9.0.3 bcryptjs@^2.4.3 zod@^3.22.4 express-mongo-sanitize@^2.2.0 express-rate-limit@^7.1.5
```

### Step 2: Generate Secrets (1 minute)

```bash
# Generate JWT secret (copy output)
openssl rand -base64 64

# Generate JWT refresh secret
openssl rand -base64 64
```

### Step 3: Update Environment Variables (1 minute)

```bash
# .env
JWT_SECRET=<paste-your-64-character-secret-here>
JWT_REFRESH_SECRET=<paste-your-64-character-refresh-secret-here>
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=aera
FRONTEND_ORIGIN=http://localhost:5173
```

### Step 4: Switch to Secure Server (30 seconds)

```bash
# Backup old server
mv server.js server-old.js

# Use new secure server
mv server-new.js server.js
```

### Step 5: Start Server (30 seconds)

```bash
node server.js
```

**Expected output**:
```
✅ JWT_SECRET validation passed
✅ MongoDB connected
✅ Server running on port 5000
```

### Step 6: Test Security (1 minute)

```bash
# Should return 401 (unauthorized)
curl http://localhost:5000/api/inventory

# Should work (after login)
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"<your-password>"}' \
  | jq -r '.token')

curl http://localhost:5000/api/inventory \
  -H "Authorization: Bearer $TOKEN"
```

✅ **Done!** Your app is now secure. See [TEST_PLAN.md](TEST_PLAN.md) for 19 comprehensive tests.

---

## Option B: Full Supabase Migration (Phases 1-3)

**Use this if**: You want to migrate to Supabase for real-time, RLS, and modern architecture

### Step 1: Create Supabase Project (2 minutes)

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose region, set database password
4. Copy Project URL and Anon Key

### Step 2: Deploy Database Schema (2 minutes)

1. Open Supabase SQL Editor
2. Copy contents of `supabase/schema.sql`
3. Paste and run
4. Copy contents of `supabase/rls-policies.sql`
5. Paste and run

### Step 3: Configure Frontend (1 minute)

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Create .env
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" > .env
echo "VITE_SUPABASE_ANON_KEY=your-anon-key" >> .env
```

### Step 4: Follow Integration Guide (Ongoing)

See [supabase/FRONTEND_INTEGRATION_GUIDE.md](supabase/FRONTEND_INTEGRATION_GUIDE.md) for:
- Authentication migration
- CRUD operations
- Real-time subscriptions
- Offline support

✅ **Done!** Follow the guide to complete migration over 6-8 weeks.

---

## 📋 What You Just Fixed

### Security Vulnerabilities:
- ✅ **Auth Bypass** - All routes now require valid JWT
- ✅ **Weak Secrets** - Server won't start without strong JWT_SECRET
- ✅ **Password Reset Exposure** - Tokens hashed, never exposed
- ✅ **NoSQL Injection** - Sanitization + validation active
- ✅ **Brute Force** - Rate limiting (5 login attempts per 15 min)

### Rate Limits:
- Auth endpoints: **5 requests per 15 minutes**
- API endpoints: **100 requests per 15 minutes**

### Data Validation:
- All requests validated with Zod schemas
- MongoDB operators (`$`, `.`) automatically stripped
- Invalid data returns 400 with clear error messages

---

## 🧪 Quick Test Suite

### Test 1: Auth Protection
```bash
# Should fail (401)
curl http://localhost:5000/api/inventory
```

### Test 2: Login
```bash
# Should succeed
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"<your-password>"}'
```

### Test 3: Rate Limiting
```bash
# Try 6 login attempts (6th should fail with 429)
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"you@example.com","password":"<your-password>"}'
  echo ""
done
```

### Test 4: Input Validation
```bash
# Should fail (400) - invalid email
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail","password":"pass"}'
```

### Test 5: NoSQL Injection Prevention
```bash
# Should fail (sanitized)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":{"$ne":null},"password":{"$ne":null}}'
```

✅ **All tests should behave as expected**

---

## 📖 Documentation Map

**Overwhelmed? Start here:**

1. **Just want security fixes?** → [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
2. **Ready to test?** → [TEST_PLAN.md](TEST_PLAN.md)
3. **Deploying to production?** → [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
4. **Migrating to Supabase?** → [supabase/FRONTEND_INTEGRATION_GUIDE.md](supabase/FRONTEND_INTEGRATION_GUIDE.md)
5. **Planning sprints?** → [JIRA_SPRINT_BACKLOG.md](JIRA_SPRINT_BACKLOG.md)
6. **Worried about gotchas?** → [GOTCHAS_AND_FIXES.md](GOTCHAS_AND_FIXES.md)
7. **Need high-level overview?** → [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## 🆘 Troubleshooting

### Server won't start
**Error**: `JWT_SECRET must be at least 32 characters`

**Fix**:
```bash
openssl rand -base64 64 > .secret
export JWT_SECRET=$(cat .secret)
node server.js
```

---

### MongoDB connection failed
**Error**: `MongoNetworkError: connect ECONNREFUSED`

**Fix**:
```bash
# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

---

### Rate limit blocking legitimate users
**Error**: `429 Too Many Requests`

**Fix**: Adjust limits in `server.js`:
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Increase from 5 to 10
  // ...
});
```

---

### Tests failing
**Issue**: Test endpoints returning 404

**Fix**: Make sure you're using `server-new.js` (renamed to `server.js`)

---

## 🎓 Learning Path

### Beginner (1-2 days)
1. Read [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
2. Deploy Phase 1 security fixes (this guide)
3. Run test suite from [TEST_PLAN.md](TEST_PLAN.md)

### Intermediate (1-2 weeks)
4. Review [GOTCHAS_AND_FIXES.md](GOTCHAS_AND_FIXES.md)
5. Implement critical gotchas (localStorage, offline sync, JWT refresh)
6. Set up Supabase project and deploy schema

### Advanced (6-8 weeks)
7. Follow [JIRA_SPRINT_BACKLOG.md](JIRA_SPRINT_BACKLOG.md) for sprint planning
8. Migrate frontend with [supabase/FRONTEND_INTEGRATION_GUIDE.md](supabase/FRONTEND_INTEGRATION_GUIDE.md)
9. Execute data migration and cutover

---

## 🔥 Production Checklist

**Before deploying to production:**

- [ ] JWT_SECRET is 64+ characters
- [ ] JWT_REFRESH_SECRET is 64+ characters
- [ ] All environment variables set
- [ ] MongoDB connection string uses authentication
- [ ] CORS restricted to production domain
- [ ] All 19 security tests pass ([TEST_PLAN.md](TEST_PLAN.md))
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Health check endpoint working (`/health`)
- [ ] Backup strategy in place
- [ ] Rollback procedure documented

---

## 💡 Pro Tips

### Tip 1: Use PM2 for Production
```bash
npm install -g pm2
pm2 start server.js --name aera-api
pm2 save
pm2 startup
```

### Tip 2: Monitor Logs
```bash
# Watch server logs
pm2 logs aera-api

# Check error rate
pm2 monit
```

### Tip 3: Auto-restart on Crash
```bash
pm2 start server.js --name aera-api --watch --max-restarts 10
```

### Tip 4: Load Balancing (for high traffic)
```bash
pm2 start server.js --name aera-api -i max  # Use all CPU cores
```

---

## 📞 Getting Help

### Documentation
- **Implementation**: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **Testing**: [TEST_PLAN.md](TEST_PLAN.md)
- **Deployment**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- **Supabase**: [supabase/FRONTEND_INTEGRATION_GUIDE.md](supabase/FRONTEND_INTEGRATION_GUIDE.md)

### Common Issues
- **Security**: See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) Section 3
- **Gotchas**: See [GOTCHAS_AND_FIXES.md](GOTCHAS_AND_FIXES.md)
- **Supabase**: See [supabase/FRONTEND_INTEGRATION_GUIDE.md](supabase/FRONTEND_INTEGRATION_GUIDE.md)

---

## 🎉 Success Metrics

After deploying Phase 1, you should see:

✅ **Zero** authentication bypass attempts succeed  
✅ **Zero** password reset tokens exposed in logs  
✅ **Zero** NoSQL injection attacks succeed  
✅ **100%** of routes protected with auth  
✅ **5x** reduction in brute force login attempts  

---

**Ready to deploy?** Start with Option A above, then review [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for production deployment.

**Questions?** Check the relevant guide in the Documentation Map section.

**Good luck! 🚀**
