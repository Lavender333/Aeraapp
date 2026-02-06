import 'dotenv/config';
import mongoose from 'mongoose';
import { Organization } from '../models/organization.js';

const SEED_ORGS = [
  {
    code: 'CH-9921',
    name: 'Grace Community Church',
    type: 'CHURCH',
    address: '4500 Main St',
    adminContact: 'Pastor John',
    adminPhone: '555-0101',
    replenishmentProvider: 'Diocese HQ',
    replenishmentEmail: 'supply@diocese.example.org',
    replenishmentPhone: '555-9000',
    verified: true,
    active: true,
    registeredPopulation: 200,
    currentBroadcast: 'Choir practice cancelled. Shelter open in Gym.',
  },
  {
    code: 'NGO-5500',
    name: 'Regional Aid Network',
    type: 'NGO',
    address: '100 Relief Blvd',
    adminContact: 'Sarah Connor',
    adminPhone: '555-0102',
    replenishmentProvider: 'FEMA Region 4',
    replenishmentEmail: 'logistics@fema.example.gov',
    replenishmentPhone: '555-9001',
    verified: true,
    active: true,
    registeredPopulation: 1200,
  },
];

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ Missing MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(mongoUri, {
  dbName: process.env.MONGODB_DB,
});

for (const org of SEED_ORGS) {
  const existing = await Organization.findOne({ code: org.code }).lean();
  if (existing) {
    console.log(`Skipping existing org: ${org.code}`);
    continue;
  }
  await Organization.create(org);
  console.log(`Created org: ${org.code}`);
}

await mongoose.disconnect();
console.log('✅ Organization migration complete');
