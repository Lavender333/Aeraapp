import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}

const client = new MongoClient(mongoUri);
await client.connect();
const dbName = process.env.MONGODB_DB || client.options?.dbName;
const db = dbName ? client.db(dbName) : client.db();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/orgs/:orgId/inventory', async (req, res) => {
  const orgId = req.params.orgId;
  const doc = await db.collection('inventories').findOne({ orgId });
  res.json(doc || { orgId, water: 0, food: 0, blankets: 0, medicalKits: 0 });
});

app.post('/api/orgs/:orgId/inventory', async (req, res) => {
  const orgId = req.params.orgId;
  const { water = 0, food = 0, blankets = 0, medicalKits = 0 } = req.body || {};
  await db.collection('inventories').updateOne(
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
