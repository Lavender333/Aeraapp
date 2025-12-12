import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import { Inventory } from './models/inventory.js';

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

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
