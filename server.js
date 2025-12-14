import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import { Inventory } from './models/inventory.js';
import { Request } from './models/request.js';
import { MemberStatus } from './models/memberStatus.js';
import { Broadcast } from './models/broadcast.js';
import { HelpRequest } from './models/helpRequest.js';
import { Member } from './models/member.js';
import { User } from './models/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*'}));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}

await mongoose.connect(mongoUri, {
  dbName: process.env.MONGODB_DB,
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// --- Auth helpers ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const signToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, orgId: user.orgId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'missing auth' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid auth' });
  }
};

// --- Auth routes ---
app.post('/api/auth/register', async (req, res) => {
  const { email, phone, password, fullName = '', role = 'GENERAL_USER', orgId } = req.body || {};
  if ((!email && !phone) || !password) {
    return res.status(400).json({ error: 'email or phone and password required' });
  }
  const exists = await User.findOne({ $or: [{ email }, { phone }] });
  if (exists) return res.status(409).json({ error: 'user already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, phone, passwordHash, role, orgId, fullName });
  const token = signToken(user);
  res.json({ token, user: { id: user._id, email, phone, role, orgId, fullName } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, phone, password } = req.body || {};
  const user = await User.findOne(
    email ? { email } : { phone }
  );
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = signToken(user);
  res.json({ token, user: { id: user._id, email: user.email, phone: user.phone, role: user.role, orgId: user.orgId, fullName: user.fullName } });
});

app.post('/api/auth/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await User.findOne({ email });
  if (!user) return res.json({ ok: true }); // do not leak existence
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  user.resetToken = token;
  user.resetTokenExpiresAt = expires;
  await user.save();
  // In production send email; here we just return token for demo
  res.json({ ok: true, resetToken: token });
});

app.post('/api/auth/reset', async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  const user = await User.findOne({ email, resetToken: token, resetTokenExpiresAt: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: 'invalid or expired token' });
  user.passwordHash = await bcrypt.hash(newPassword || '', 10);
  user.resetToken = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
  res.json({ ok: true });
});

app.get('/api/orgs/:orgId/inventory', async (req, res) => {
  const orgId = req.params.orgId;
  const doc = await Inventory.findOne({ orgId }).lean();
  res.json(doc || { orgId, water: 0, food: 0, blankets: 0, medicalKits: 0 });
});

app.post('/api/orgs/:orgId/inventory', async (req, res) => {
  const orgId = req.params.orgId;
  const { water = 0, food = 0, blankets = 0, medicalKits = 0 } = req.body || {};
  await Inventory.updateOne(
    { orgId },
    { $set: { water, food, blankets, medicalKits } },
    { upsert: true }
  );
  res.json({ ok: true });
});

// Replenishment Requests
app.get('/api/orgs/:orgId/requests', async (req, res) => {
  const orgId = req.params.orgId;
  const docs = await Request.find({ orgId }).sort({ createdAt: -1 }).lean();
  res.json(docs);
});

app.post('/api/orgs/:orgId/requests', async (req, res) => {
  const orgId = req.params.orgId;
  const { item, quantity, provider, orgName } = req.body || {};
  if (!item || !quantity) return res.status(400).json({ error: 'item and quantity required' });
  const doc = await Request.create({
    orgId,
    orgName,
    item,
    quantity,
    provider,
    status: 'PENDING',
  });
  res.json(doc);
});

app.post('/api/requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, deliveredQuantity = 0 } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status required' });
  const doc = await Request.findByIdAndUpdate(
    id,
    { $set: { status, deliveredQuantity } },
    { new: true }
  ).lean();
  if (!doc) return res.status(404).json({ error: 'not found' });

  // If stocked, apply delivered quantity to inventory
  if (status === 'STOCKED' && doc.orgId && deliveredQuantity > 0) {
    const inc = {};
    if (doc.item.toLowerCase().includes('water')) inc.water = deliveredQuantity;
    else if (doc.item.toLowerCase().includes('food')) inc.food = deliveredQuantity;
    else if (doc.item.toLowerCase().includes('blanket')) inc.blankets = deliveredQuantity;
    else if (doc.item.toLowerCase().includes('med')) inc.medicalKits = deliveredQuantity;
    if (Object.keys(inc).length > 0) {
      await Inventory.updateOne(
        { orgId: doc.orgId },
        { $inc: inc },
        { upsert: true }
      );
    }
  }

  res.json(doc);
});

// Member Status (Safe/Danger/Unknown)
app.get('/api/orgs/:orgId/status', async (req, res) => {
  const orgId = req.params.orgId;
  const members = await MemberStatus.find({ orgId }).lean();
  const counts = members.reduce(
    (acc, m) => {
      acc[m.status.toLowerCase()] = (acc[m.status.toLowerCase()] || 0) + 1;
      return acc;
    },
    { safe: 0, danger: 0, unknown: 0 }
  );
  res.json({ counts, members });
});

app.post('/api/orgs/:orgId/status', async (req, res) => {
  const orgId = req.params.orgId;
  const { memberId, name, status } = req.body || {};
  if (!memberId || !status) return res.status(400).json({ error: 'memberId and status required' });
  const allowed = ['SAFE', 'DANGER', 'UNKNOWN'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
  await MemberStatus.updateOne(
    { orgId, memberId },
    { $set: { name, status } },
    { upsert: true }
  );
  const members = await MemberStatus.find({ orgId }).lean();
  const counts = members.reduce(
    (acc, m) => {
      acc[m.status.toLowerCase()] = (acc[m.status.toLowerCase()] || 0) + 1;
      return acc;
    },
    { safe: 0, danger: 0, unknown: 0 }
  );
  res.json({ ok: true, counts, members });
});

// Broadcast / Ticker
app.get('/api/orgs/:orgId/broadcast', async (req, res) => {
  const orgId = req.params.orgId;
  const doc = await Broadcast.findOne({ orgId }).lean();
  res.json(doc || { orgId, message: '' });
});

app.post('/api/orgs/:orgId/broadcast', async (req, res) => {
  const orgId = req.params.orgId;
  const { message = '' } = req.body || {};
  await Broadcast.updateOne({ orgId }, { $set: { message } }, { upsert: true });
  const doc = await Broadcast.findOne({ orgId }).lean();
  res.json(doc);
});

// Help Requests (SOS / Status)
app.get('/api/orgs/:orgId/help', async (req, res) => {
  const orgId = req.params.orgId;
  const docs = await HelpRequest.find({ orgId }).sort({ createdAt: -1 }).lean();
  res.json(docs);
});

app.get('/api/users/:userId/help/active', async (req, res) => {
  const userId = req.params.userId;
  const doc = await HelpRequest.findOne({ userId }).sort({ createdAt: -1 }).lean();
  if (!doc) return res.json(null);
  res.json({
    ...doc,
    id: doc._id.toString(),
    timestamp: doc.createdAt,
  });
});

app.post('/api/users/:userId/help', async (req, res) => {
  const userId = req.params.userId;
  const { orgId, data = {}, priority = 'LOW', location = '', status = 'RECEIVED' } = req.body || {};
  const doc = await HelpRequest.create({
    orgId,
    userId,
    data,
    priority,
    location,
    status,
  });
  res.json({
    ...doc.toObject(),
    id: doc._id.toString(),
    timestamp: doc.createdAt,
  });
});

app.post('/api/help/:id/location', async (req, res) => {
  const { id } = req.params;
  const { location = '' } = req.body || {};
  const doc = await HelpRequest.findByIdAndUpdate(
    id,
    { $set: { location } },
    { new: true }
  ).lean();
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json({
    ...doc,
    id: doc._id.toString(),
    timestamp: doc.createdAt,
  });
});

// Member CRUD
app.get('/api/orgs/:orgId/members', async (req, res) => {
  const orgId = req.params.orgId;
  const docs = await Member.find({ orgId }).sort({ createdAt: -1 }).lean();
  res.json(docs.map((m) => ({ ...m, id: m._id.toString() })));
});

app.post('/api/orgs/:orgId/members', async (req, res) => {
  const orgId = req.params.orgId;
  const payload = req.body || {};
  const doc = await Member.create({ ...payload, orgId });
  res.json({ ...doc.toObject(), id: doc._id.toString() });
});

app.put('/api/orgs/:orgId/members/:id', async (req, res) => {
  const { orgId, id } = req.params;
  const payload = req.body || {};
  const doc = await Member.findOneAndUpdate({ _id: id, orgId }, { $set: payload }, { new: true }).lean();
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json({ ...doc, id: doc._id.toString() });
});

app.delete('/api/orgs/:orgId/members/:id', async (req, res) => {
  const { orgId, id } = req.params;
  await Member.deleteOne({ _id: id, orgId });
  res.json({ ok: true });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
