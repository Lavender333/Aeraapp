# Phase 1 Security Fixes - Test Plan

## Prerequisites

1. Server running locally on `http://localhost:4000`
2. MongoDB connected
3. JWT_SECRET configured (minimum 32 characters)

## Test Environment Setup

```bash
# Set base URL for all tests
BASE_URL="http://localhost:4000/api"

# Helper function for colored output
success() { echo "✅ $1"; }
failure() { echo "❌ $1"; }
info() { echo "ℹ️  $1"; }
```

---

## Test 1: Auth Bypass Prevention

### 1.1 Access Protected Route Without Token
**Vulnerability**: Previously, some routes may not have enforced auth.

```bash
# Should return 401 Unauthorized
curl -X GET "$BASE_URL/orgs/CH-9921/inventory" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "missing authorization header"
}
```
**Status**: 401

---

### 1.2 Access Protected Route With Invalid Token
**Vulnerability**: Weak token validation.

```bash
# Should return 401 Unauthorized
curl -X GET "$BASE_URL/orgs/CH-9921/inventory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token-12345" \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "invalid token"
}
```
**Status**: 401

---

### 1.3 Access Another Org's Data
**Vulnerability**: No org-based access control.

```bash
# Step 1: Register and login as user for org CH-9921
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!",
    "orgId": "CH-9921",
    "fullName": "Test User"
  }' | jq -r '.token' > /tmp/token.txt

TOKEN=$(cat /tmp/token.txt)

# Step 2: Try to access different org's inventory (CH-8888)
curl -X GET "$BASE_URL/orgs/CH-8888/inventory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "access denied to this organization"
}
```
**Status**: 403

---

## Test 2: JWT Token Forgery Prevention

### 2.1 Server Starts Without JWT_SECRET
**Vulnerability**: Fallback to weak secret.

```bash
# Remove JWT_SECRET from environment
unset JWT_SECRET

# Try to start server
npm run server
```

**Expected Result**:
```
❌ FATAL: JWT_SECRET is required in environment
Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Server should exit with code 1**

---

### 2.2 Server Starts With Short JWT_SECRET
**Vulnerability**: Weak secret allowed.

```bash
# Set short JWT_SECRET
export JWT_SECRET="short"

# Try to start server
npm run server
```

**Expected Result**:
```
❌ FATAL: JWT_SECRET must be at least 32 characters (current: 5)
Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Server should exit with code 1**

---

### 2.3 Forged Token With Different Secret
**Vulnerability**: Token signed with different secret accepted.

```bash
# Generate forged token with different secret
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: '123', role: 'ADMIN', orgId: 'CH-9921' },
  'wrong-secret',
  { expiresIn: '7d' }
);
console.log(token);
" > /tmp/forged-token.txt

FORGED_TOKEN=$(cat /tmp/forged-token.txt)

# Try to use forged token
curl -X GET "$BASE_URL/orgs/CH-9921/inventory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FORGED_TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "invalid token"
}
```
**Status**: 401

---

## Test 3: Password Reset Token Exposure

### 3.1 Reset Token NOT in Response
**Vulnerability**: Reset token returned in API response.

```bash
# Request password reset
RESPONSE=$(curl -X POST "$BASE_URL/auth/forgot" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com"
  }')

echo $RESPONSE | jq .
```

**Expected Result**:
```json
{
  "ok": true
}
```
**Response should NOT contain `resetToken` field**

---

### 3.2 Reset Token Logged in Dev Mode
**Vulnerability**: No way to get token in dev mode.

```bash
# Check server console logs for token
# Should see output like:
```

**Expected Console Output**:
```
🔐 Password Reset Token (DEV MODE ONLY):
   Email: testuser@example.com
   Token: a1b2c3d4e5f6...
   Expires: 2026-02-05T12:30:00.000Z
   ⚠️  This would be sent via email in production
```

---

### 3.3 Reset Token Stored as Hash
**Vulnerability**: Plain text token in database.

```bash
# Connect to MongoDB and check user document
mongosh "$MONGODB_URI" --eval "
  use aeraapp;
  db.users.findOne({ email: 'testuser@example.com' }, { resetTokenHash: 1, resetToken: 1 })
"
```

**Expected Result**:
```json
{
  "_id": ObjectId("..."),
  "resetTokenHash": "a3f5e8b2c1d9..." // SHA-256 hash (64 chars)
  // Should NOT have "resetToken" field
}
```

---

### 3.4 Password Reset With Valid Token
**Vulnerability**: Reset flow broken.

```bash
# Use token from server logs
TOKEN="<token-from-console>"

# Reset password
curl -X POST "$BASE_URL/auth/reset" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "token": "'$TOKEN'",
    "newPassword": "NewSecurePass123!"
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "ok": true
}
```
**Status**: 200

---

### 3.5 Cannot Reuse Reset Token
**Vulnerability**: Token can be reused.

```bash
# Try to use same token again
curl -X POST "$BASE_URL/auth/reset" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "token": "'$TOKEN'",
    "newPassword": "AnotherPass123!"
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "invalid or expired token"
}
```
**Status**: 400

---

## Test 4: NoSQL Injection Prevention

### 4.1 NoSQL Injection in Login
**Vulnerability**: MongoDB operator injection.

```bash
# Try to bypass login with NoSQL injection
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": {"$ne": null},
    "password": {"$ne": null}
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email"
    }
  ]
}
```
**Status**: 400

---

### 4.2 NoSQL Injection in Query Params
**Vulnerability**: Operator injection in URL params.

```bash
# Try to inject operator in orgId
curl -X GET "$BASE_URL/orgs/\$ne/inventory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
- `$` character should be sanitized to `_`
- Query should fail to find org with id `_ne`

**Check server logs for**:
```
⚠️  Sanitized key detected: $ in /api/orgs/$ne/inventory
```

---

### 4.3 NoSQL Injection in Request Body
**Vulnerability**: Operator injection in JSON body.

```bash
# Try to inject operator in inventory update
curl -X POST "$BASE_URL/orgs/CH-9921/inventory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "water": {"$inc": 1000},
    "food": 100
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "validation failed",
  "details": [
    {
      "field": "water",
      "message": "Expected number, received object"
    }
  ]
}
```
**Status**: 400

---

## Test 5: Rate Limit Enforcement

### 5.1 Auth Endpoint Rate Limit (5 per 15 min)
**Vulnerability**: Brute force attacks possible.

```bash
# Make 6 login attempts rapidly
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrong-password"
    }' \
    -w "\nStatus: %{http_code}\n\n"
  sleep 1
done
```

**Expected Result**:
- Attempts 1-5: Status 401 (invalid credentials)
- Attempt 6: Status 429 (rate limited)

```json
{
  "error": "Too many authentication attempts, please try again later"
}
```

**Check response headers**:
```
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: <timestamp>
```

---

### 5.2 General API Rate Limit (100 per 15 min)
**Vulnerability**: API abuse possible.

```bash
# Make 101 requests rapidly to any endpoint
for i in {1..101}; do
  curl -s -X GET "$BASE_URL/health" -w "%{http_code}\n" -o /dev/null
done | tail -1
```

**Expected Result**:
- First 100 requests: Status 200
- 101st request: Status 429

---

## Test 6: Input Validation

### 6.1 Missing Required Fields
**Vulnerability**: Server crashes on missing data.

```bash
# Register without password
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```
**Status**: 400

---

### 6.2 Invalid Email Format
**Vulnerability**: Malformed data accepted.

```bash
# Register with invalid email
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "SecurePass123!"
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email"
    }
  ]
}
```
**Status**: 400

---

### 6.3 Invalid Enum Values
**Vulnerability**: Invalid status values accepted.

```bash
# Update member status with invalid value
curl -X POST "$BASE_URL/orgs/CH-9921/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "memberId": "M001",
    "name": "John Doe",
    "status": "INVALID_STATUS"
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:
```json
{
  "error": "validation failed",
  "details": [
    {
      "field": "status",
      "message": "Invalid enum value..."
    }
  ]
}
```
**Status**: 400

---

## Test Summary Script

Complete test script with automated verification:

```bash
#!/bin/bash

# AERA Phase 1 Security Test Suite
# Run this script to verify all security fixes

set -e

BASE_URL="${BASE_URL:-http://localhost:4000/api}"
echo "Testing AERA API at: $BASE_URL"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}✅ $1${NC}"; }
failure() { echo -e "${RED}❌ $1${NC}"; }

# Test 1: Auth required
echo -e "\n📝 Test 1: Auth Bypass Prevention"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/orgs/CH-9921/inventory")
if [ "$RESPONSE" = "401" ]; then
  success "Protected route requires auth"
else
  failure "Protected route accessible without auth (got $RESPONSE)"
fi

# Test 2: Rate limiting
echo -e "\n📝 Test 2: Rate Limit Enforcement"
COUNT=0
for i in {1..6}; do
  CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}')
  if [ "$CODE" = "429" ]; then
    COUNT=$((COUNT + 1))
  fi
done
if [ $COUNT -gt 0 ]; then
  success "Rate limiting active (got 429 on attempt after limit)"
else
  failure "Rate limiting not working"
fi

# Test 3: NoSQL injection blocked
echo -e "\n📝 Test 3: NoSQL Injection Prevention"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":{"$ne":null},"password":"test"}' \
  -w "%{http_code}")
if [[ "$RESPONSE" == *"400"* ]] || [[ "$RESPONSE" == *"validation failed"* ]]; then
  success "NoSQL injection blocked"
else
  failure "NoSQL injection not blocked"
fi

# Test 4: Password reset token not exposed
echo -e "\n📝 Test 4: Password Reset Token Security"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/forgot" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
if [[ "$RESPONSE" == *"resetToken"* ]]; then
  failure "Reset token exposed in response!"
else
  success "Reset token not exposed in response"
fi

echo -e "\n========================================"
echo "✅ Security test suite complete"
echo "Check server logs for detailed validation"
```

---

## Manual Verification Checklist

- [ ] Server fails to start without JWT_SECRET
- [ ] Server fails to start with JWT_SECRET < 32 chars
- [ ] Protected routes return 401 without token
- [ ] Invalid tokens are rejected
- [ ] Org-based access control enforced
- [ ] User-based access control enforced
- [ ] Password reset token NOT in API response
- [ ] Password reset token logged in dev mode console
- [ ] Password reset token stored as hash in database
- [ ] Password reset works with valid token
- [ ] Password reset token cannot be reused
- [ ] NoSQL injection in login blocked
- [ ] NoSQL injection in URL params sanitized
- [ ] NoSQL injection in request body blocked by validation
- [ ] Auth rate limit enforced (5 per 15 min)
- [ ] General API rate limit enforced (100 per 15 min)
- [ ] Missing required fields rejected with clear error
- [ ] Invalid email format rejected
- [ ] Invalid enum values rejected

---

**Test Environment**: Development  
**Date**: February 5, 2026  
**Phase**: 1 - Critical Security Fixes
