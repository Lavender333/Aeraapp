# Phase 1 Security Fixes - Deployment Checklist

## Pre-Deployment Setup

### 1. Generate JWT Secret

The JWT_SECRET must be a cryptographically secure random string of at least 32 characters.

**Generate a secure secret:**
```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 32

# Method 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example output:**
```
a7f3e9d2c1b8a4f6e3d9c2b1a7f3e9d2c1b8a4f6e3d9c2b1a7f3e9d2c1b8a4f6
```

⚠️ **IMPORTANT**: 
- Never commit secrets to version control
- Use different secrets for dev, staging, and production
- Store secrets securely (environment variables, secret managers)

---

### 2. Required Environment Variables

Create a `.env` file (or configure in your hosting platform):

```bash
# REQUIRED - Database connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=aeraapp

# REQUIRED - JWT authentication (MINIMUM 32 characters)
JWT_SECRET=your-generated-secret-here-minimum-32-chars

# OPTIONAL - CORS configuration
FRONTEND_ORIGIN=https://lavender333.github.io

# OPTIONAL - Server port (default: 4000)
PORT=4000

# OPTIONAL - Environment mode (affects password reset token logging)
NODE_ENV=production
```

---

### 3. Install Dependencies

```bash
# Install new security dependencies
npm install zod express-mongo-sanitize express-rate-limit

# Verify all dependencies installed
npm list zod express-mongo-sanitize express-rate-limit
```

---

### 4. Database Migration

The User schema has changed from `resetToken` to `resetTokenHash`.

**Option A: No action required (recommended)**
- Old tokens will naturally expire (15 min TTL)
- Users can request new tokens if needed

**Option B: Clean up existing tokens (optional)**
```javascript
// Connect to MongoDB and run:
db.users.updateMany(
  { resetToken: { $exists: true } },
  { 
    $unset: { resetToken: "", resetTokenExpiresAt: "" },
    $set: { resetTokenHash: null, resetTokenExpiresAt: null }
  }
);
```

---

## Local Deployment

### 1. Backup Current Server
```bash
cp server.js server-backup-$(date +%Y%m%d).js
```

### 2. Deploy New Server
```bash
# Replace server.js with secured version
cp server-new.js server.js
```

### 3. Update Environment
```bash
# Create or update .env file
cat > .env << EOF
MONGODB_URI=your-mongodb-uri
MONGODB_DB=aeraapp
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
FRONTEND_ORIGIN=http://localhost:3000
PORT=4000
NODE_ENV=development
EOF
```

### 4. Test Locally
```bash
# Start server
npm run server

# Expected output:
# ✅ JWT_SECRET validated (length: 64)
# ✅ MongoDB connected
# ✅ AERA API listening on http://localhost:4000
```

### 5. Run Test Suite
```bash
# Run security test suite
bash PHASE1_TEST_PLAN.md  # Execute the test script section
```

---

## Staging Deployment

### Render.io Deployment

#### 1. Update Environment Variables

In Render.io dashboard:
1. Go to your service → Environment
2. Add/update these variables:

```
JWT_SECRET = <generate-new-secret-with-32+-chars>
MONGODB_URI = <your-mongodb-atlas-uri>
MONGODB_DB = aeraapp
FRONTEND_ORIGIN = https://lavender333.github.io
NODE_ENV = staging
```

#### 2. Update render.yaml (if using)

```yaml
services:
  - type: web
    name: aera-api
    env: node
    buildCommand: npm install
    startCommand: npm run server
    envVars:
      - key: NODE_ENV
        value: staging
      - key: JWT_SECRET
        sync: false  # Mark as secret
      - key: MONGODB_URI
        sync: false  # Mark as secret
      - key: MONGODB_DB
        value: aeraapp
      - key: FRONTEND_ORIGIN
        value: https://lavender333.github.io
```

#### 3. Deploy

```bash
# Method 1: Push to connected Git branch
git add .
git commit -m "Phase 1: Critical security fixes"
git push origin main

# Method 2: Manual deploy via Render dashboard
# Click "Manual Deploy" → "Deploy latest commit"
```

#### 4. Verify Deployment

```bash
# Check deployment logs for success messages
# Expected:
# ✅ JWT_SECRET validated (length: 64)
# ✅ MongoDB connected
# ✅ AERA API listening on http://localhost:10000

# Test health endpoint
curl https://aera-api.onrender.com/api/health

# Expected response:
# {"ok":true,"timestamp":"2026-02-05T..."}
```

---

## Production Deployment

### Pre-Production Checklist

- [ ] All staging tests passed
- [ ] JWT_SECRET is different from staging (generate new)
- [ ] MongoDB production database configured
- [ ] CORS configured for production frontend URL
- [ ] NODE_ENV set to "production"
- [ ] Email service configured for password resets (TODO in code)
- [ ] Monitoring and logging configured
- [ ] Backup strategy in place

### 1. Generate Production Secrets

```bash
# Generate new production JWT secret
PROD_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Production JWT_SECRET: $PROD_JWT_SECRET"
# Store in secure secret manager (AWS Secrets Manager, HashiCorp Vault, etc.)
```

### 2. Update Production Environment Variables

```bash
# Production environment variables
JWT_SECRET=<production-secret-different-from-staging>
MONGODB_URI=<production-mongodb-uri>
MONGODB_DB=aeraapp-prod
FRONTEND_ORIGIN=https://lavender333.github.io
NODE_ENV=production
PORT=4000
```

### 3. Deploy to Production

Follow same steps as staging deployment.

### 4. Post-Deployment Verification

```bash
# Set production URL
PROD_URL="https://your-production-api.com/api"

# Test 1: Health check
curl $PROD_URL/health

# Test 2: Auth required
curl -w "%{http_code}" $PROD_URL/orgs/CH-9921/inventory
# Should return: 401

# Test 3: Rate limiting
for i in {1..6}; do
  curl -s -w "%{http_code}\n" -X POST $PROD_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -o /dev/null
done
# Should return 429 on 6th request

# Test 4: Register and login
curl -X POST $PROD_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify@example.com",
    "password": "SecurePass123!",
    "fullName": "Verification User"
  }'
# Should return token

# Test 5: Password reset (token NOT in response)
curl -X POST $PROD_URL/auth/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com"}' | jq .
# Should return: {"ok":true}
# Should NOT contain resetToken field
```

---

## Rollback Plan

### If Critical Issues Arise

```bash
# Restore backup
cp server-backup-YYYYMMDD.js server.js

# Restart service
npm run server

# Or in Render.io: Rollback to previous deployment
```

⚠️ **Note**: Users who requested password resets during new deployment will need to request new tokens after rollback.

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Server startup failures**
   - Alert on: JWT_SECRET validation errors
   - Alert on: MongoDB connection errors

2. **Authentication failures**
   - Track: 401 error rates
   - Alert on: Spike in authentication failures

3. **Rate limit hits**
   - Track: 429 error rates
   - Alert on: Excessive rate limiting (potential attack or misconfiguration)

4. **NoSQL injection attempts**
   - Monitor server logs for: "Sanitized key detected" warnings
   - Alert on: Multiple injection attempts from same IP

5. **Password reset requests**
   - Track: Reset request volume
   - Alert on: Unusual spike (potential attack)

### Example Monitoring Setup (Optional)

```javascript
// Add to server.js for basic logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log authentication failures
authRouter.post('/login', async (req, res) => {
  // ... existing code ...
  if (!user || !ok) {
    logger.warn('Failed login attempt', {
      email: req.body.email,
      ip: req.ip,
      timestamp: new Date(),
    });
  }
});
```

---

## Security Verification

### Final Security Checklist

#### Authentication & Authorization
- [ ] JWT_SECRET is minimum 32 characters
- [ ] JWT_SECRET is not committed to version control
- [ ] All protected routes require authentication
- [ ] Org-based access control enforced
- [ ] User-based access control enforced
- [ ] Invalid tokens are rejected
- [ ] Expired tokens are rejected

#### Password Reset
- [ ] Reset tokens are NOT exposed in API responses
- [ ] Reset tokens are stored as hashes in database
- [ ] Reset tokens expire after 15 minutes
- [ ] Reset tokens cannot be reused
- [ ] In dev mode: tokens logged to console
- [ ] In production: tokens sent via email (TODO)

#### Input Validation
- [ ] All request bodies validated with Zod
- [ ] NoSQL injection attempts blocked
- [ ] Invalid enum values rejected
- [ ] Required fields enforced
- [ ] Email format validation working

#### Rate Limiting
- [ ] Auth endpoints: 5 requests per 15 minutes
- [ ] General API: 100 requests per 15 minutes
- [ ] Rate limit headers sent in responses
- [ ] 429 errors returned when limit exceeded

#### Infrastructure
- [ ] MongoDB connection secure (TLS)
- [ ] CORS configured for frontend origin only
- [ ] Server starts with required environment variables
- [ ] Error logging configured
- [ ] Backup strategy in place

---

## Troubleshooting

### Issue: Server won't start - "Missing JWT_SECRET"

**Solution:**
```bash
# Generate and set JWT_SECRET
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npm run server
```

### Issue: Server won't start - "JWT_SECRET must be at least 32 characters"

**Solution:**
```bash
# Generate longer secret
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npm run server
```

### Issue: "Cannot find module 'zod'"

**Solution:**
```bash
npm install zod express-mongo-sanitize express-rate-limit
```

### Issue: Frontend getting 401 errors after deployment

**Causes:**
1. Frontend using old tokens (signed with old secret)
2. JWT_SECRET mismatch between environments

**Solution:**
1. Users need to log in again (new tokens)
2. Clear localStorage in browser
3. Verify JWT_SECRET is correctly set in environment

### Issue: Password reset not working in production

**Cause:** Email service not configured (TODO in code)

**Temporary Solution:**
1. Set NODE_ENV=development temporarily
2. Check server logs for token
3. Manually send token to user

**Permanent Solution:**
Implement email service (see TODO comments in server.js)

---

## Environment Variable Reference

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `MONGODB_URI` | Yes | - | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `MONGODB_DB` | Yes | - | Database name | `aeraapp` |
| `JWT_SECRET` | **Yes** | - | JWT signing secret (min 32 chars) | `a7f3e9d2c1b8...` |
| `FRONTEND_ORIGIN` | No | `*` | CORS allowed origin | `https://lavender333.github.io` |
| `PORT` | No | `4000` | Server port | `4000` |
| `NODE_ENV` | No | `development` | Environment mode | `production` |

---

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Verify all tests pass in production
- [ ] Monitor error logs for issues
- [ ] Test user registration and login
- [ ] Test password reset flow
- [ ] Verify rate limiting is working

### Short-term (Week 1)
- [ ] Implement email service for password resets
- [ ] Set up automated monitoring alerts
- [ ] Review and analyze security logs
- [ ] Gather user feedback on auth experience

### Medium-term (Month 1)
- [ ] Implement refresh token rotation
- [ ] Add 2FA for admin accounts
- [ ] Conduct security audit
- [ ] Optimize rate limit thresholds based on usage

---

## Success Criteria

The deployment is successful when:

✅ Server starts without errors  
✅ All environment variables validated  
✅ Protected routes require authentication  
✅ Invalid tokens are rejected  
✅ Password reset tokens not exposed  
✅ NoSQL injection attempts blocked  
✅ Rate limiting enforces limits  
✅ All test suite tests pass  
✅ Users can register and login  
✅ Users can reset passwords  
✅ No security vulnerabilities from Phase 1 list remain

---

**Deployment Guide Version**: 1.0  
**Last Updated**: February 5, 2026  
**Phase**: 1 - Critical Security Fixes  
**Status**: Ready for Production
