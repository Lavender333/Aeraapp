import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import mongoose from 'mongoose';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import 'dotenv/config';
import crypto from 'crypto';
import { Inventory } from './models/inventory.js';
import { Request } from './models/request.js';
import { Broadcast } from './models/broadcast.js';
import { HelpRequest } from './models/helpRequest.js';
import { Member } from './models/member.js';
import { Organization } from './models/organization.js';
import { RevokedToken } from './models/revokedToken.js';
import { User } from './models/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { auth, requireOrgAccess, requireRole, requirePermission } from './middleware/auth.js';
import { validate } from './middleware/validate.js';
import { logger } from './utils/logger.js';
import { sendSecurityAlert } from './utils/securityAlert.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  updateInventorySchema,
  adjustInventorySchema,
  createRequestSchema,
  updateRequestStatusSchema,
  updateMemberStatusSchema,
  updateBroadcastSchema,
  createHelpRequestSchema,
  updateHelpLocationSchema,
  createMemberSchema,
  updateMemberSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  orgIdParamSchema,
  requestIdParamSchema,
  memberIdParamSchema,
  orgMemberStatusParamSchema,
  helpIdParamSchema,
  userIdParamSchema,
  organizationIdParamSchema,
  paginationQuerySchema,
} from './validation/schemas.js';

// ===== FAIL-FAST VALIDATION =====

// Validate MongoDB URI
const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri && !isTest) {
  logger.error('Missing MONGODB_URI in environment');
  process.exit(1);
}

// Validate JWT_SECRET - MUST be set and minimum 32 characters
const JWT_SECRET = process.env.JWT_SECRET || (isTest ? 'test-secret-12345678901234567890123456789012' : undefined);
if (!JWT_SECRET) {
  logger.error('JWT_SECRET is required in environment');
  logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  logger.error(`JWT_SECRET must be at least 32 characters (current: ${JWT_SECRET.length})`);
  logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

logger.info(`JWT_SECRET validated (length: ${JWT_SECRET.length})`);

// Validate JWT_REFRESH_SECRET
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (isTest ? 'test-refresh-12345678901234567890123456789012' : undefined);
if (!JWT_REFRESH_SECRET) {
  logger.error('JWT_REFRESH_SECRET is required in environment');
  logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
if (JWT_REFRESH_SECRET.length < 32) {
  logger.error(`JWT_REFRESH_SECRET must be at least 32 characters (current: ${JWT_REFRESH_SECRET.length})`);
  logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

logger.info(`JWT_REFRESH_SECRET validated (length: ${JWT_REFRESH_SECRET.length})`);

// ===== EXPRESS APP SETUP =====

export const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 15552000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'no-referrer' },
  noSniff: true,
}));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  !isProd ? 'http://localhost:3000' : null,
  !isProd ? 'http://localhost:3001' : null,
].filter(Boolean);
if (!allowedOrigins.length && !isTest) {
  logger.error('No allowed CORS origins configured');
  process.exit(1);
}
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed'));
    },
  })
);

// Body parser
app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID();
  next();
});

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data') && !req.allowMultipart) {
    return res.status(415).json({
      error: {
        code: 415,
        message: 'file uploads are not supported',
        requestId: req.requestId,
      },
    });
  }
  return next();
});

app.use(express.json({ limit: '10kb' }));

// Request logging
app.use(
  morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// NoSQL injection protection - sanitize all user input
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  Sanitized key detected: ${key} in ${req.path}`);
  },
}));

// ===== DATABASE CONNECTION =====

if (!isTest) {
  try {
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB,
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err?.message || err });
    process.exit(1);
  }
}

// ===== RATE LIMITING =====

const redisUrl = process.env.REDIS_URL;
const redisClient = redisUrl ? new Redis(redisUrl) : null;
const rateLimitStore = redisClient
  ? new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    })
  : undefined;

// Strict rate limit for authentication endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
});

// Password reset rate limit (stricter)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
});

// ===== AUTH HELPERS =====

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, orgId: user.orgId, jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), jti: crypto.randomUUID() },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

const revokeToken = async (jti, exp) => {
  if (!jti || !exp) return;
  const expiresAt = new Date(exp * 1000);
  await RevokedToken.updateOne(
    { jti },
    { $set: { jti, expiresAt } },
    { upsert: true }
  );
};

const isTokenRevoked = async (jti) => {
  if (!jti) return false;
  const doc = await RevokedToken.findOne({ jti }).lean();
  return !!doc;
};

const AUTH_MAX_ATTEMPTS = Number(process.env.AUTH_MAX_ATTEMPTS || 5);
const AUTH_LOCK_MINUTES = Number(process.env.AUTH_LOCK_MINUTES || 15);

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

// Public organizations list (for discovery)
publicRouter.get('/organizations', validate(paginationQuerySchema, 'query'), async (req, res) => {
  const { page, limit, skip } = parsePagination(req, 50);
  const filter = { active: true };

  if (req.query.type) {
    filter.type = req.query.type;
  }
  if (req.query.verified !== undefined) {
    filter.verified = req.query.verified === 'true';
  }

  const [items, total] = await Promise.all([
    Organization.find(filter)
      .select('name type address verified active code')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Organization.countDocuments(filter),
  ]);

  res.json({ page, limit, total, items });
});

publicRouter.get('/organizations/:id', validate(organizationIdParamSchema, 'params'), async (req, res) => {
  const org = await Organization.findById(req.params.id).lean();
  if (!org) return respondError(res, 404, 'Organization not found');
  res.json(org);
});

// --- Auth routes ---

publicRouter.post(
  '/auth/register',
  authLimiter,
  validate(registerSchema),
  async (req, res) => {
    const { email, phone, password, fullName, role, orgId } = req.body;

    logger.info('Auth register attempt', { requestId: req.requestId, email, phone, ip: req.ip });

    const exists = await User.findOne({ $or: [{ email }, { phone }].filter(Boolean) });
    if (exists) {
      logger.warn('Auth register failed: user exists', { requestId: req.requestId, email, phone });
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

    logger.info('Auth login attempt', { requestId: req.requestId, email, phone, ip: req.ip });

    const user = await User.findOne(email ? { email } : { phone });
    if (!user) {
      logger.warn('Auth login failed: user not found', { requestId: req.requestId, email, phone });
      return res.status(401).json({ error: 'invalid credentials' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      logger.warn('Auth login blocked: account locked', { requestId: req.requestId, userId: user._id });
      await sendSecurityAlert({
        type: 'account_lockout',
        userId: user._id.toString(),
        email: user.email,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return res.status(423).json({ error: 'account locked, try again later' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const attempts = (user.loginAttempts || 0) + 1;
      const updates = { loginAttempts: attempts };
      if (attempts >= AUTH_MAX_ATTEMPTS) {
        updates.lockUntil = new Date(Date.now() + AUTH_LOCK_MINUTES * 60 * 1000);
      }
      await User.updateOne({ _id: user._id }, { $set: updates });
      logger.warn('Auth login failed: invalid credentials', { requestId: req.requestId, userId: user._id, attempts });
      return res.status(401).json({ error: 'invalid credentials' });
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { loginAttempts: 0, lockUntil: undefined, lastLoginAt: new Date(), lastLoginIp: req.ip } }
    );

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    logger.info('Auth login success', { requestId: req.requestId, userId: user._id.toString() });
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
      if (await isTokenRevoked(decoded.jti)) {
        return res.status(401).json({ error: 'invalid refresh token' });
      }
      const user = await User.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({ error: 'invalid refresh token' });
      }

      await revokeToken(decoded.jti, decoded.exp);
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
  resetLimiter,
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

    try {
      await sendResetEmail({ email, token });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Email not sent (DEV MODE)', { error: err?.message || err });
        logger.info('Password Reset Token (DEV MODE ONLY)', {
          email,
          token,
          expires: expires.toISOString(),
        });
      }
    }

    res.json({ ok: true });
  }
);

publicRouter.post(
  '/auth/reset',
  resetLimiter,
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
const INVENTORY_MAX = 1000000;
const clampInventoryValue = (value) => Math.min(Math.max(Number(value) || 0, 0), INVENTORY_MAX);
const INVENTORY_ITEM_MAP = {
  water: ['water'],
  food: ['food'],
  blankets: ['blanket'],
  medicalKits: ['med', 'medical'],
};

const respondError = (res, status, message, details) => {
  res.status(status).json({
    error: {
      code: status,
      message,
      details: details || undefined,
      requestId: res.req.requestId,
    },
  });
};

const parsePagination = (req, defaultLimit = 50) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || `${defaultLimit}`, 10), 1), 200);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const resolveOrganization = async (orgId) => {
  if (mongoose.isValidObjectId(orgId)) {
    const byId = await Organization.findById(orgId).lean();
    if (byId) return byId;
  }
  return Organization.findOne({ code: orgId }).lean();
};

const requireOrgExists = (paramName = 'orgId') => async (req, res, next) => {
  const orgId = req.params[paramName];
  const org = await resolveOrganization(orgId);
  if (!org) {
    return respondError(res, 404, 'Organization not found');
  }
  req.organization = org;
  return next();
};

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;

const mailTransport = smtpHost && smtpPort && smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })
  : null;

const sendResetEmail = async ({ email, token }) => {
  if (!mailTransport || !smtpFrom) {
    throw new Error('SMTP not configured');
  }
  const resetLink = `${process.env.FRONTEND_ORIGIN || ''}/reset?token=${token}&email=${encodeURIComponent(email)}`;
  await mailTransport.sendMail({
    from: smtpFrom,
    to: email,
    subject: 'Password Reset',
    text: `Your password reset link: ${resetLink}`,
  });
};

// All protected routes require authentication
protectedRouter.use(auth);

protectedRouter.post('/auth/logout', validate(logoutSchema), async (req, res) => {
  if (req.user?.jti && req.user?.exp) {
    await revokeToken(req.user.jti, req.user.exp);
  }

  const { refreshToken } = req.body || {};
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      await revokeToken(decoded.jti, decoded.exp);
    } catch (err) {
      logger.warn('Logout refresh token invalid', { requestId: req.requestId });
    }
  }

  res.json({ ok: true });
});

// --- Inventory routes ---

protectedRouter.get(
  '/orgs/:orgId/inventory',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('inventory:read'),
  async (req, res) => {
  const { orgId } = req.params;
  logger.info('Inventory read', { requestId: req.requestId, orgId, userId: req.user?.sub });
  const doc = await Inventory.findOne({ orgId }).lean();
  res.json(doc || { orgId, water: 0, food: 0, blankets: 0, medicalKits: 0 });
  }
);

protectedRouter.post(
  '/orgs/:orgId/inventory',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('inventory:update'),
  validate(updateInventorySchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { water, food, blankets, medicalKits } = req.body;

    const sanitized = {
      water: clampInventoryValue(water),
      food: clampInventoryValue(food),
      blankets: clampInventoryValue(blankets),
      medicalKits: clampInventoryValue(medicalKits),
    };

    await Inventory.updateOne(
      { orgId },
      { $set: sanitized },
      { upsert: true }
    );

    logger.info('Inventory updated', { requestId: req.requestId, orgId, userId: req.user?.sub });

    res.json({ ok: true });
  }
);

protectedRouter.post(
  '/orgs/:orgId/inventory/adjust',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('inventory:update'),
  validate(adjustInventorySchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { water, food, blankets, medicalKits } = req.body;

    const inc = {};
    if (water !== undefined) inc.water = water;
    if (food !== undefined) inc.food = food;
    if (blankets !== undefined) inc.blankets = blankets;
    if (medicalKits !== undefined) inc.medicalKits = medicalKits;

    if (!Object.keys(inc).length) {
      return respondError(res, 400, 'no inventory adjustments provided');
    }

    await Inventory.updateOne(
      { orgId },
      { $inc: inc },
      { upsert: true }
    );

    logger.info('Inventory adjusted', { requestId: req.requestId, orgId, userId: req.user?.sub, inc });
    res.json({ ok: true });
  }
);

// --- Replenishment Request routes ---

protectedRouter.get(
  '/orgs/:orgId/requests',
  validate(orgIdParamSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('requests:read'),
  async (req, res) => {
  const { orgId } = req.params;
  const { page, limit, skip } = parsePagination(req, 50);
  const [items, total] = await Promise.all([
    Request.find({ orgId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Request.countDocuments({ orgId }),
  ]);
  res.json({ page, limit, total, items });
  }
);

protectedRouter.post(
  '/orgs/:orgId/requests',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('requests:create'),
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
  validate(requestIdParamSchema, 'params'),
  requirePermission('requests:update'),
  validate(updateRequestStatusSchema),
  async (req, res) => {
    const { id } = req.params;
    const {
      status,
      deliveredQuantity,
      signature,
      signedAt,
      receivedSignature,
      receivedAt,
      stocked,
      stockedAt,
      stockedQuantity,
      orgConfirmed,
      orgConfirmedAt,
    } = req.body;

    const updates = { status };
    if (deliveredQuantity !== undefined) updates.deliveredQuantity = deliveredQuantity;
    if (signature !== undefined) updates.signature = signature;
    if (signedAt !== undefined) updates.signedAt = signedAt;
    if (receivedSignature !== undefined) updates.receivedSignature = receivedSignature;
    if (receivedAt !== undefined) updates.receivedAt = receivedAt;
    if (stocked !== undefined) updates.stocked = stocked;
    if (stockedAt !== undefined) updates.stockedAt = stockedAt;
    if (stockedQuantity !== undefined) updates.stockedQuantity = stockedQuantity;
    if (orgConfirmed !== undefined) updates.orgConfirmed = orgConfirmed;
    if (orgConfirmedAt !== undefined) updates.orgConfirmedAt = orgConfirmedAt;

    const doc = await Request.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();

    if (!doc) {
      return respondError(res, 404, 'not found');
    }

    // Verify user has access to this request's org
    if (req.user.role !== 'ADMIN' && req.user.orgId !== doc.orgId) {
      return respondError(res, 403, 'access denied');
    }

    // If stocked, apply delivered quantity to inventory
    const appliedQuantity = clampInventoryValue((stockedQuantity ?? deliveredQuantity) || 0);
    if (status === 'STOCKED' && doc.orgId && appliedQuantity > 0) {
      const inc = {};
      const itemLower = doc.item.toLowerCase();
      for (const [key, matches] of Object.entries(INVENTORY_ITEM_MAP)) {
        if (matches.some((m) => itemLower.includes(m))) {
          inc[key] = appliedQuantity;
          break;
        }
      }

      if (Object.keys(inc).length > 0) {
        await Inventory.updateOne({ orgId: doc.orgId }, { $inc: inc }, { upsert: true });
      }
    }

    res.json(doc);
  }
);

// --- Member Status routes ---

protectedRouter.get(
  '/orgs/:orgId/status',
  validate(orgMemberStatusParamSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('members:read'),
  async (req, res) => {
  const { orgId } = req.params;
  const { page, limit, skip } = parsePagination(req, 50);

  const [members, total] = await Promise.all([
    Member.find({ orgId, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Member.countDocuments({ orgId, deletedAt: { $exists: false } }),
  ]);

  const counts = await Member.aggregate([
    { $match: { orgId, deletedAt: { $exists: false } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const normalizedCounts = counts.reduce(
    (acc, row) => {
      const key = (row._id || 'UNKNOWN').toLowerCase();
      acc[key] = row.count;
      return acc;
    },
    { safe: 0, danger: 0, unknown: 0 }
  );

  res.json({ counts: normalizedCounts, page, limit, total, items: members });
  }
);

protectedRouter.post(
  '/orgs/:orgId/status',
  validate(orgMemberStatusParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('members:update'),
  validate(updateMemberStatusSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { memberId, name, status } = req.body;

    const updates = {
      status,
      statusUpdatedAt: new Date(),
      lastUpdate: new Date().toISOString(),
      lastUpdateAt: new Date(),
    };
    if (name) updates.name = name;

    const member = await Member.findOneAndUpdate(
      { _id: memberId, orgId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!member) {
      return respondError(res, 404, 'member not found');
    }

    const counts = await Member.aggregate([
      { $match: { orgId, deletedAt: { $exists: false } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const normalizedCounts = counts.reduce(
      (acc, row) => {
        const key = (row._id || 'UNKNOWN').toLowerCase();
        acc[key] = row.count;
        return acc;
      },
      { safe: 0, danger: 0, unknown: 0 }
    );

    res.json({ ok: true, counts: normalizedCounts, member });
  }
);

// --- Broadcast routes ---

protectedRouter.get(
  '/orgs/:orgId/broadcast',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('broadcast:read'),
  async (req, res) => {
  const { orgId } = req.params;
  const doc = await Broadcast.findOne({ orgId }).lean();
  res.json(doc || { orgId, message: '' });
  }
);

protectedRouter.post(
  '/orgs/:orgId/broadcast',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('broadcast:update'),
  validate(updateBroadcastSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const { message } = req.body;

    const historyEntry = message
      ? { message, createdAt: new Date(), authorId: req.user?.sub }
      : null;

    if (historyEntry) {
      await Broadcast.updateOne(
        { orgId },
        {
          $set: { message },
          $push: { history: { $each: [historyEntry], $slice: -50 } },
        },
        { upsert: true }
      );
    } else {
      await Broadcast.updateOne({ orgId }, { $set: { message } }, { upsert: true });
    }
    const doc = await Broadcast.findOne({ orgId }).lean();

    res.json(doc);
  }
);

// --- Help Request routes ---

protectedRouter.get(
  '/orgs/:orgId/help',
  validate(orgIdParamSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('requests:read'),
  async (req, res) => {
  const { orgId } = req.params;
  const { page, limit, skip } = parsePagination(req, 50);
  const [items, total] = await Promise.all([
    HelpRequest.find({ orgId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    HelpRequest.countDocuments({ orgId }),
  ]);
  res.json({ page, limit, total, items });
  }
);

protectedRouter.get('/users/:userId/help/active', validate(userIdParamSchema, 'params'), async (req, res) => {
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
  validate(userIdParamSchema, 'params'),
  validate(createHelpRequestSchema),
  async (req, res) => {
    const { userId } = req.params;

    // Verify user can only create help requests for themselves
    if (req.user.role !== 'ADMIN' && req.user.sub !== userId) {
      return res.status(403).json({ error: 'access denied' });
    }

    const { orgId, data, priority, location, status } = req.body;

    if (orgId) {
      const org = await resolveOrganization(orgId);
      if (!org) {
        return respondError(res, 404, 'Organization not found');
      }
    }

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
  validate(helpIdParamSchema, 'params'),
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
      return respondError(res, 404, 'not found');
    }

    // Verify user has access to this help request
    if (req.user.role !== 'ADMIN' && req.user.sub !== doc.userId) {
      return respondError(res, 403, 'access denied');
    }

    res.json({
      ...doc,
      id: doc._id.toString(),
      timestamp: doc.createdAt,
    });
  }
);

// --- Member CRUD routes ---

protectedRouter.get(
  '/orgs/:orgId/members',
  validate(orgIdParamSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('members:read'),
  async (req, res) => {
  const { orgId } = req.params;
  const { page, limit, skip } = parsePagination(req, 50);
  const [items, total] = await Promise.all([
    Member.find({ orgId, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Member.countDocuments({ orgId, deletedAt: { $exists: false } }),
  ]);
    res.json({
      page,
      limit,
      total,
      items: items.map((m) => ({ ...m, id: m._id.toString() })),
    });
  }
);

protectedRouter.post(
  '/orgs/:orgId/members',
  validate(orgIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('members:create'),
  validate(createMemberSchema),
  async (req, res) => {
    const { orgId } = req.params;
    const payload = req.body;

    const doc = await Member.create({
      ...payload,
      orgId,
      statusUpdatedAt: payload.status ? new Date() : undefined,
      lastUpdateAt: payload.status ? new Date() : undefined,
    });

    res.status(201).json({ ...doc.toObject(), id: doc._id.toString() });
  }
);

protectedRouter.put(
  '/orgs/:orgId/members/:id',
  validate(memberIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('members:update'),
  validate(updateMemberSchema),
  async (req, res) => {
    const { orgId, id } = req.params;
    const payload = req.body;

    if (payload.status) {
      payload.statusUpdatedAt = new Date();
      payload.lastUpdate = new Date().toISOString();
      payload.lastUpdateAt = new Date();
    }

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

protectedRouter.delete(
  '/orgs/:orgId/members/:id',
  validate(memberIdParamSchema, 'params'),
  requireOrgExists(),
  requireOrgAccess(),
  requirePermission('members:delete'),
  async (req, res) => {
  const { orgId, id } = req.params;
  await Member.updateOne(
    { _id: id, orgId },
    { $set: { deletedAt: new Date() } }
  );
  res.json({ ok: true, deleted: true });
  }
);

// --- Organization CRUD (protected) ---

protectedRouter.post(
  '/organizations',
  requirePermission('org:update'),
  validate(createOrganizationSchema),
  async (req, res) => {
    const code = req.body.code || req.body.id;
    const org = await Organization.create({
      ...req.body,
      code,
    });
    res.status(201).json(org);
  }
);

protectedRouter.put(
  '/organizations/:id',
  validate(organizationIdParamSchema, 'params'),
  requirePermission('org:update'),
  validate(updateOrganizationSchema),
  async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.orgId !== id) {
      return res.status(403).json({ error: 'access denied to this organization' });
    }

    const org = await Organization.findByIdAndUpdate(id, { $set: req.body }, { new: true }).lean();
    if (!org) return respondError(res, 404, 'Organization not found');
    res.json(org);
  }
);

protectedRouter.delete(
  '/organizations/:id',
  validate(organizationIdParamSchema, 'params'),
  requireRole(['ADMIN']),
  async (req, res) => {
    const { id } = req.params;
    const org = await Organization.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true }
    ).lean();
    if (!org) return respondError(res, 404, 'Organization not found');
    res.json({ ok: true, organization: org });
  }
);

// --- Admin Export ---

protectedRouter.get(
  '/admin/export/:orgId',
  validate(orgIdParamSchema, 'params'),
  requireRole(['ADMIN']),
  requireOrgExists(),
  async (req, res) => {
    const { orgId } = req.params;
    const [
      organization,
      members,
      inventory,
      requests,
      helpRequests,
      broadcast,
    ] = await Promise.all([
      resolveOrganization(orgId),
      Member.find({ orgId, deletedAt: { $exists: false } }).lean(),
      Inventory.findOne({ orgId }).lean(),
      Request.find({ orgId }).lean(),
      HelpRequest.find({ orgId }).lean(),
      Broadcast.findOne({ orgId }).lean(),
    ]);

    res.json({
      organization,
      members,
      inventory,
      requests,
      helpRequests,
      broadcast,
      exportedAt: new Date().toISOString(),
    });
  }
);

// ===== MOUNT ROUTERS =====

app.use('/api', apiLimiter, publicRouter);
app.use('/api', protectedRouter); // Note: protectedRouter has its own auth middleware
// API versioning (v1)
app.use('/api/v1', apiLimiter, publicRouter);
app.use('/api/v1', protectedRouter);

// ===== ERROR HANDLER =====

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err?.message || err, requestId: req.requestId });
  respondError(res, err.status || 500, err.message || 'internal server error');
});

// ===== START SERVER =====

const port = process.env.PORT || 4000;
let server;
if (!isTest) {
  server = app.listen(port, () => {
    logger.info(`AERA API listening on http://localhost:${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('MongoDB: Connected');
    logger.info(`Auth: JWT (secret length: ${JWT_SECRET.length})`);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    if (redisClient) {
      await redisClient.quit();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
