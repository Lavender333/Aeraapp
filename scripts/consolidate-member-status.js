import 'dotenv/config';
import mongoose from 'mongoose';
import { Member } from '../models/member.js';
import { MemberStatus } from '../models/memberStatus.js';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ Missing MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(mongoUri, {
  dbName: process.env.MONGODB_DB,
});

const statuses = await MemberStatus.find().lean();
let updated = 0;
let missing = 0;

for (const status of statuses) {
  const result = await Member.updateOne(
    { _id: status.memberId, orgId: status.orgId },
    {
      $set: {
        status: status.status,
        statusUpdatedAt: status.updatedAt || new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    missing += 1;
  } else {
    updated += 1;
  }
}

console.log(`✅ MemberStatus migration complete. Updated: ${updated}, Missing: ${missing}`);
console.log('⚠️  After verification, drop memberstatuses collection manually.');

await mongoose.disconnect();
