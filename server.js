import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import { Inventory } from './models/inventory.js';
import { Request } from './models/request.js';

const app = express();
app.use(cors());
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

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
