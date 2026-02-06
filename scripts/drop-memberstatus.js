import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ Missing MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(mongoUri, {
  dbName: process.env.MONGODB_DB,
});

const collections = await mongoose.connection.db.listCollections({ name: 'memberstatuses' }).toArray();
if (collections.length === 0) {
  console.log('ℹ️  memberstatuses collection does not exist');
} else {
  await mongoose.connection.db.dropCollection('memberstatuses');
  console.log('✅ memberstatuses collection dropped');
}

await mongoose.disconnect();
