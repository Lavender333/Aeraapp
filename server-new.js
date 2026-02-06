import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import crypto from 'crypto';
import { Inventory } from './models/inventory.js';
import { Request } from './models/request.js';
import { MemberStatus } from './models/memberStatus.js';
import { Broadcast } from './models/broadcast.js';
import { HelpRequest } from './models/helpRequest.js';
import { Member } from './models/member.js';
import { User } from './models/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { auth, requireOrgAccess } from './middleware/auth.js';
import { validate } from './middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  updateInventorySchema,
  createRequestSchema,
  updateRequestStatusSchema,
  updateMemberStatusSchema,
  updateBroadcastSchema,
  createHelpRequestSchema,
  updateHelpLocationSchema,
  createMemberSchema,
  updateMemberSchema,
} from './validation/schemas.js';

// ===== FAIL-FAST VALIDATION =====

// Validate MongoDB URI
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ FATAL: Missing MONGODB_URI in environment');
  process.exit(1);
}

// Validate JWT_SECRET - MUST be set and minimum 32 characters
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is required in environment');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error(`❌ FATAL: JWT_SECRET must be at least 32 characters (current: ${JWT_SECRET.length})`);
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

console.log('✅ JWT_SECRET validated (length: ' + JWT_SECRET.length + ')');

// Validate JWT_REFRESH_SECRET
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  console.error('❌ FATAL: JWT_REFRESH_SECRET is required in environment');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
if (JWT_REFRESH_SECRET.length < 32) {
  console.error(`❌ FATAL: JWT_REFRESH_SECRET must be at least 32 characters (current: ${JWT_REFRESH_SECRET.length})`);
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

console.log('✅ JWT_REFRESH_SECRET validated (length: ' + JWT_REFRESH_SECRET.length + ')');

// ===== EXPRESS APP SETUP =====

const app = express();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }));

// Body parser
app.use(express.json());

// NoSQL injection protection - sanitize all user input
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  Sanitized key detected: ${key} in ${req.path}`);
  },
}));

// ===== DATABASE CONNECTION =====

await mongoose.connect(mongoUri, {
  dbName: process.env.MONGODB_DB,
});
console.log('✅ MongoDB connected');

// ===== RATE LIMITING =====

// Strict rate limit for authentication endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===== AUTH HELPERS =====

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, orgId: user.orgId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id.toString() },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

/**
 * Generate secure reset token (plain text) and its hash
 * @returns {{ token: string, hash: string }}
 */
const generateResetToken = () => {
  // Generate cryptographically secure random token
  const token = crypto.randomBytes(32).toString('hex');
  // Hash it before storing in database
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
};

/**
 * Hash a reset token for comparison
 * @param {string} token - Plain text token
 * @returns {string} Hashed token
 */
const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// ===== PUBLIC ROUTER (NO AUTH REQUIRED) =====

const publicRouter = express.Router();

// Health check
publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// --- Auth routes ---

publicRouter.post(
  '/auth/register',
  authLimiter,
  validate(registerSchema),
  async (req, res) => {
    const { email, phone, password, fullName, role, orgId } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { phone }].filter(Boolean) });
    if (exists) {
      return res.status(409).json({ error: 'user already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, phone, passwordHash, role, orgId, fullName });
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(201).json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        orgId: user.orgId,
        fullName: user.fullName,
      },
    });
  }
);

publicRouter.post(
  '/auth/login',
  authLimiter,
  validate(loginSchema),
  async (req, res) => {
    const { email, phone, password } = req.body;

    const user = await User.findOne(email ? { email } : { phone });
    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    res.json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        orgId: user.orgId,
        fullName: user.fullName,
      },
    });
  }
);

publicRouter.post(
  '/auth/refresh',
  authLimiter,
  validate(refreshTokenSchema),
  async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({ error: 'invalid refresh token' });
      }

      const accessToken = signAccessToken(user);
      const newRefreshToken = signRefreshToken(user);

      return res.json({
        token: accessToken,
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      return res.status(401).json({ error: 'invalid refresh token' });
    }
  }
);

publicRouter.post(
  '/auth/forgot',
  authLimiter,
  validate(forgotPasswordSchema),
  async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't leak user existence - always return success
      return res.json({ ok: true });
    }

    // Generate secure token and hash
    const { token, hash } = generateResetToken();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store ONLY the hash in database
    user.resetTokenHash = hash;
    user.resetTokenExpiresAt = expires;
    await user.save();

    // In production: send token via email
    // In dev mode: log to console (NEVER send in API response)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔐 Password Reset Token (DEV MODE ONLY):');
      console.log(`   Email: ${email}`);
      console.log(`   Token: ${token}`);
      console.log(`   Expires: ${expires.toISOString()}`);
      console.log('   ⚠️  This would be sent via email in production');
    }

    // TODO: Send email with token in production
    // await sendEmail({
    //   to: email,
    //   subject: 'Password Reset',
    //   text: `Your reset token: ${token}`,
    // });

    res.json({ ok: true });
  }
);

publicRouter.post(
  '/auth/reset',
  authLimiter,
  validate(resetPasswordSchema),
  async (req, res) => {
    const { email, token, newPassword } = req.body;

    // Hash the provided token for comparison
    const tokenHash = hashResetToken(token);

    // Find user with matching email, hashed token, and non-expired token
    const user = await User.findOne({
      email,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    // Update password and clear reset token
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();

    res.json({ ok: true });
  }
);

// ===== PROTECTED ROUTER (AUTH REQUIRED) =====

const protectedRouter = express.Router();

// All protected routes require authentication
protectedRouter.use(auth);

// --- Inventory routes ---

protectedRouter.get('/orgs/:orgId/inventory', requireOrgAccess(), async (req, res) => {
  const { orgId } = req.params;
  const doc = await Inventory.findOne({ orgId }).lean();
  res.json(doc || { orgId, water: 0, food: 0, blankets: 0, medicalKits: 0 });
});

protectedRouter.post(
  '/orgs/:orgId/inventory',
  requireOrgAccess(),
  validate(updateInventorySchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { water, food, blankets, medicalKits } = req.body;

    await Inventory.updateOne(
      { orgId },
      { $set: { water, food, blankets, medicalKits } },
      { upsert: true }
    );

    res.json({ ok: true });
  }
);

// --- Replenishment Request routes ---

protectedRouter.get('/orgs/:orgId/requests', requireOrgAccess(), async (req, res) => {
  const { orgId } = req.params;
  const docs = await Request.find({ orgId }).sort({ createdAt: -1 }).lean();
  res.json(docs);
});

protectedRouter.post(
  '/orgs/:orgId/requests',
  requireOrgAccess(),
  validate(createRequestSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { item, quantity, provider, orgName } = req.body;

    const doc = await Request.create({
      orgId,
      orgName,
      item,
      quantity,
      provider,
      status: 'PENDING',
    });

    res.status(201).json(doc);
  }
);

protectedRouter.post(
  '/requests/:id/status',
  validate(updateRequestStatusSchema),
  async (req, res) => {
    const { id } = req.params;
    const { status, deliveredQuantity } = req.body;

    const doc = await Request.findByIdAndUpdate(
      id,
      { $set: { status, deliveredQuantity } },
      { new: true }
    ).lean();

    if (!doc) {
      return res.status(404).json({ error: 'not found' });
    }

    // Verify user has access to this request's org
    if (req.user.role !== 'ADMIN' && req.user.orgId !== doc.orgId) {
      return res.status(403).json({ error: 'access denied' });
    }

    // If stocked, apply delivered quantity to inventory
    if (status === 'STOCKED' && doc.orgId && deliveredQuantity > 0) {
      const inc = {};
      const itemLower = doc.item.toLowerCase();
      if (itemLower.includes('water')) inc.water = deliveredQuantity;
      else if (itemLower.includes('food')) inc.food = deliveredQuantity;
      else if (itemLower.includes('blanket')) inc.blankets = deliveredQuantity;
      else if (itemLower.includes('med')) inc.medicalKits = deliveredQuantity;

      if (Object.keys(inc).length > 0) {
        await Inventory.updateOne({ orgId: doc.orgId }, { $inc: inc }, { upsert: true });
      }
    }

    res.json(doc);
  }
);

// --- Member Status routes ---

protectedRouter.get('/orgs/:orgId/status', requireOrgAccess(), async (req, res) => {
  const { orgId } = req.params;
  const members = await MemberStatus.find({ orgId }).lean();
  const counts = members.reduce(
    (acc, m) => {
      const status = m.status.toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { safe: 0, danger: 0, unknown: 0 }
  );
  res.json({ counts, members });
});

protectedRouter.post(
  '/orgs/:orgId/status',
  requireOrgAccess(),
  validate(updateMemberStatusSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { memberId, name, status } = req.body;

    await MemberStatus.updateOne(
      { orgId, memberId },
      { $set: { name, status } },
      { upsert: true }
    );

    const members = await MemberStatus.find({ orgId }).lean();
    const counts = members.reduce(
      (acc, m) => {
        const status = m.status.toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { safe: 0, danger: 0, unknown: 0 }
    );

    res.json({ ok: true, counts, members });
  }
);

// --- Broadcast routes ---

protectedRouter.get('/orgs/:orgId/broadcast', requireOrgAccess(), async (req, res) => {
  const { orgId } = req.params;
  const doc = await Broadcast.findOne({ orgId }).lean();
  res.json(doc || { orgId, message: '' });
});

protectedRouter.post(
  '/orgs/:orgId/broadcast',
  requireOrgAccess(),
  validate(updateBroadcastSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { message } = req.body;

    await Broadcast.updateOne({ orgId }, { $set: { message } }, { upsert: true });
    const doc = await Broadcast.findOne({ orgId }).lean();

    res.json(doc);
  }
);

// --- Help Request routes ---

protectedRouter.get('/orgs/:orgId/help', requireOrgAccess(), async (req, res) => {
  const { orgId } = req.params;
  const docs = await HelpRequest.find({ orgId }).sort({ createdAt: -1 }).lean();
  res.json(docs);
});

protectedRouter.get('/users/:userId/help/active', async (req, res) => {
  const { userId } = req.params;

  // Verify user can only access their own help requests
  if (req.user.role !== 'ADMIN' && req.user.sub !== userId) {
    return res.status(403).json({ error: 'access denied' });
  }

  const doc = await HelpRequest.findOne({ userId }).sort({ createdAt: -1 }).lean();
  if (!doc) {
    return res.json(null);
  }

  res.json({
    ...doc,
    id: doc._id.toString(),
    timestamp: doc.createdAt,
  });
});

protectedRouter.post(
  '/users/:userId/help',
  validate(createHelpRequestSchema),
  async (req, res) => {
    const { userId } = req.params;

    // Verify user can only create help requests for themselves
    if (req.user.role !== 'ADMIN' && req.user.sub !== userId) {
      return res.status(403).json({ error: 'access denied' });
    }

    const { orgId, data, priority, location, status } = req.body;

    const doc = await HelpRequest.create({
      orgId,
      userId,
      data,
      priority,
      location,
      status,
    });

    res.status(201).json({
      ...doc.toObject(),
      id: doc._id.toString(),
      timestamp: doc.createdAt,
    });
  }
);

protectedRouter.post(
  '/help/:id/location',
  validate(updateHelpLocationSchema),
  async (req, res) => {
    const { id } = req.params;
    const { location } = req.body;

    const doc = await HelpRequest.findByIdAndUpdate(
      id,
      { $set: { location } },
      { new: true }
    ).lean();

    if (!doc) {
      return res.status(404).json({ error: 'not found' });
    }

    // Verify user has access to this help request
    if (req.user.role !== 'ADMIN' && req.user.sub !== doc.userId) {
      return res.status(403).json({ error: 'access denied' });
    }

    res.json({
      ...doc,
      id: doc._id.toString(),
      timestamp: doc.createdAt,
    });
  }
);

// --- Member CRUD routes ---

protectedRouter.get('/orgs/:orgId/members', requireOrgAccess(), async (req, res) => {
  const { orgId } = req.params;
  const docs = await Member.find({ orgId }).sort({ createdAt: -1 }).lean();
  res.json(docs.map((m) => ({ ...m, id: m._id.toString() })));
});

protectedRouter.post(
  '/orgs/:orgId/members',
  requireOrgAccess(),
  validate(createMemberSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const payload = req.body;

    const doc = await Member.create({ ...payload, orgId });

    res.status(201).json({ ...doc.toObject(), id: doc._id.toString() });
  }
);

protectedRouter.put(
  '/orgs/:orgId/members/:id',
  requireOrgAccess(),
  validate(updateMemberSchema),
  async (req, res) => {
    const { orgId, id } = req.params;
    const payload = req.body;

    const doc = await Member.findOneAndUpdate(
      { _id: id, orgId },
      { $set: payload },
      { new: true }
    ).lean();

    if (!doc) {
      return res.status(404).json({ error: 'not found' });
    }

    res.json({ ...doc, id: doc._id.toString() });
  }
);

protectedRouter.delete('/orgs/:orgId/members/:id', requireOrgAccess(), async (req, res) => {
  const { orgId, id } = req.params;
  await Member.deleteOne({ _id: id, orgId });
  res.json({ ok: true });
});

// ===== MOUNT ROUTERS =====

app.use('/api', apiLimiter, publicRouter);
app.use('/api', protectedRouter); // Note: protectedRouter has its own auth middleware

// ===== ERROR HANDLER =====

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'internal server error',
  });
});

// ===== START SERVER =====

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`✅ AERA API listening on http://localhost:${port}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MongoDB: Connected`);
  console.log(`   Auth: JWT (secret length: ${JWT_SECRET.length})`);
});
