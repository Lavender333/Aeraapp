#!/usr/bin/env node
/**
 * AERA - MongoDB to Supabase Migration Script
 * 
 * This script migrates data from MongoDB to Supabase PostgreSQL
 * Run: node migrate-mongodb-to-supabase.js
 */

import mongoose from 'mongoose';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Import MongoDB models
import { User } from '../models/user.js';
import { Inventory } from '../models/inventory.js';
import { Request } from '../models/request.js';
import { MemberStatus } from '../models/memberStatus.js';
import { Broadcast } from '../models/broadcast.js';
import { HelpRequest } from '../models/helpRequest.js';
import { Member } from '../models/member.js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

const BATCH_SIZE = 100; // Process in batches to avoid memory issues

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Migration statistics
const stats = {
  organizations: { total: 0, migrated: 0, failed: 0 },
  profiles: { total: 0, migrated: 0, failed: 0 },
  inventory: { total: 0, migrated: 0, failed: 0 },
  replenishment_requests: { total: 0, migrated: 0, failed: 0 },
  member_statuses: { total: 0, migrated: 0, failed: 0 },
  broadcasts: { total: 0, migrated: 0, failed: 0 },
  help_requests: { total: 0, migrated: 0, failed: 0 },
  members: { total: 0, migrated: 0, failed: 0 },
};

// Mapping from MongoDB ObjectId to Supabase UUID
const idMap = {
  users: new Map(),
  organizations: new Map(),
};

/**
 * Connect to MongoDB
 */
async function connectMongoDB() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  console.log('✅ MongoDB connected');
}

/**
 * Validate Supabase connection
 */
async function validateSupabase() {
  console.log('🔌 Validating Supabase connection...');
  const { data, error } = await supabase.from('organizations').select('count');
  if (error && error.code !== 'PGRST116') { // PGRST116 = table empty
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  console.log('✅ Supabase connected');
}

/**
 * Step 1: Migrate Organizations
 */
async function migrateOrganizations() {
  console.log('\n📦 Step 1: Migrating Organizations...');
  
  // Extract unique orgIds from users
  const orgIds = await User.distinct('orgId').exec();
  stats.organizations.total = orgIds.filter(Boolean).length;
  
  for (const orgCode of orgIds) {
    if (!orgCode) continue;
    
    try {
      // Create organization in Supabase
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          org_code: orgCode,
          name: `Organization ${orgCode}`, // Placeholder - update manually
          type: 'CHURCH', // Default - update manually
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Map MongoDB orgCode to Supabase UUID
      idMap.organizations.set(orgCode, data.id);
      stats.organizations.migrated++;
      console.log(`  ✓ Migrated org: ${orgCode} → ${data.id}`);
    } catch (error) {
      console.error(`  ✗ Failed to migrate org ${orgCode}:`, error.message);
      stats.organizations.failed++;
    }
  }
  
  console.log(`✅ Organizations: ${stats.organizations.migrated}/${stats.organizations.total} migrated`);
}

/**
 * Step 2: Migrate Users to Profiles
 * Note: This requires Supabase Auth setup. For MVP, we create profiles without auth.users linkage.
 */
async function migrateUsers() {
  console.log('\n👤 Step 2: Migrating Users to Profiles...');
  
  const users = await User.find({}).lean();
  stats.profiles.total = users.length;
  
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    
    for (const user of batch) {
      try {
        // Map org_id
        const orgUUID = user.orgId ? idMap.organizations.get(user.orgId) : null;
        
        // For migration, we'll need to create auth.users first OR
        // use admin API to create users with specific UUIDs
        // For now, we'll create profiles with new UUIDs and note the mapping
        
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            email: user.email,
            phone: user.phone,
            full_name: user.fullName || '',
            role: user.role || 'GENERAL_USER',
            org_id: orgUUID,
            is_active: true,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Map MongoDB _id to Supabase UUID
        idMap.users.set(user._id.toString(), data.id);
        stats.profiles.migrated++;
        
        if ((i + batch.indexOf(user) + 1) % 50 === 0) {
          console.log(`  Migrated ${i + batch.indexOf(user) + 1}/${stats.profiles.total} users...`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to migrate user ${user.email}:`, error.message);
        stats.profiles.failed++;
      }
    }
  }
  
  console.log(`✅ Profiles: ${stats.profiles.migrated}/${stats.profiles.total} migrated`);
}

/**
 * Step 3: Migrate Inventory
 */
async function migrateInventory() {
  console.log('\n📦 Step 3: Migrating Inventory...');
  
  const inventoryDocs = await Inventory.find({}).lean();
  stats.inventory.total = inventoryDocs.length;
  
  for (const inv of inventoryDocs) {
    try {
      const orgUUID = idMap.organizations.get(inv.orgId);
      if (!orgUUID) {
        console.warn(`  ⚠️  Skipping inventory for unknown org: ${inv.orgId}`);
        continue;
      }
      
      const { error } = await supabase
        .from('inventory')
        .insert({
          org_id: orgUUID,
          water: inv.water || 0,
          food: inv.food || 0,
          blankets: inv.blankets || 0,
          medical_kits: inv.medicalKits || 0,
        });
      
      if (error) throw error;
      
      stats.inventory.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate inventory for ${inv.orgId}:`, error.message);
      stats.inventory.failed++;
    }
  }
  
  console.log(`✅ Inventory: ${stats.inventory.migrated}/${stats.inventory.total} migrated`);
}

/**
 * Step 4: Migrate Replenishment Requests
 */
async function migrateRequests() {
  console.log('\n📝 Step 4: Migrating Replenishment Requests...');
  
  const requests = await Request.find({}).lean();
  stats.replenishment_requests.total = requests.length;
  
  for (const req of requests) {
    try {
      const orgUUID = idMap.organizations.get(req.orgId);
      if (!orgUUID) continue;
      
      const { error } = await supabase
        .from('replenishment_requests')
        .insert({
          org_id: orgUUID,
          org_name: req.orgName,
          item: req.item,
          quantity: req.quantity,
          status: req.status || 'PENDING',
          provider: req.provider,
          delivered_quantity: req.deliveredQuantity || 0,
          created_at: req.createdAt,
          updated_at: req.updatedAt,
        });
      
      if (error) throw error;
      stats.replenishment_requests.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate request:`, error.message);
      stats.replenishment_requests.failed++;
    }
  }
  
  console.log(`✅ Replenishment Requests: ${stats.replenishment_requests.migrated}/${stats.replenishment_requests.total} migrated`);
}

/**
 * Step 5: Migrate Member Statuses
 */
async function migrateMemberStatuses() {
  console.log('\n👥 Step 5: Migrating Member Statuses...');
  
  const statuses = await MemberStatus.find({}).lean();
  stats.member_statuses.total = statuses.length;
  
  for (const status of statuses) {
    try {
      const orgUUID = idMap.organizations.get(status.orgId);
      if (!orgUUID) continue;
      
      const { error } = await supabase
        .from('member_statuses')
        .insert({
          org_id: orgUUID,
          member_id: status.memberId,
          name: status.name,
          status: status.status || 'UNKNOWN',
          last_check_in: status.updatedAt,
          created_at: status.createdAt,
          updated_at: status.updatedAt,
        });
      
      if (error) throw error;
      stats.member_statuses.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate member status:`, error.message);
      stats.member_statuses.failed++;
    }
  }
  
  console.log(`✅ Member Statuses: ${stats.member_statuses.migrated}/${stats.member_statuses.total} migrated`);
}

/**
 * Step 6: Migrate Broadcasts
 */
async function migrateBroadcasts() {
  console.log('\n📢 Step 6: Migrating Broadcasts...');
  
  const broadcasts = await Broadcast.find({}).lean();
  stats.broadcasts.total = broadcasts.length;
  
  for (const broadcast of broadcasts) {
    try {
      const orgUUID = idMap.organizations.get(broadcast.orgId);
      if (!orgUUID) continue;
      
      const { error } = await supabase
        .from('broadcasts')
        .insert({
          org_id: orgUUID,
          message: broadcast.message || '',
          created_at: broadcast.createdAt,
          updated_at: broadcast.updatedAt,
        });
      
      if (error) throw error;
      stats.broadcasts.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate broadcast:`, error.message);
      stats.broadcasts.failed++;
    }
  }
  
  console.log(`✅ Broadcasts: ${stats.broadcasts.migrated}/${stats.broadcasts.total} migrated`);
}

/**
 * Step 7: Migrate Help Requests
 */
async function migrateHelpRequests() {
  console.log('\n🆘 Step 7: Migrating Help Requests...');
  
  const helpRequests = await HelpRequest.find({}).lean();
  stats.help_requests.total = helpRequests.length;
  
  for (const req of helpRequests) {
    try {
      const orgUUID = req.orgId ? idMap.organizations.get(req.orgId) : null;
      const userUUID = idMap.users.get(req.userId);
      
      if (!userUUID) {
        console.warn(`  ⚠️  Skipping help request for unknown user: ${req.userId}`);
        continue;
      }
      
      const { error } = await supabase
        .from('help_requests')
        .insert({
          org_id: orgUUID,
          user_id: userUUID,
          status: req.status || 'RECEIVED',
          priority: req.priority || 'LOW',
          data: req.data || {},
          location: req.location,
          created_at: req.createdAt,
          updated_at: req.updatedAt,
        });
      
      if (error) throw error;
      stats.help_requests.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate help request:`, error.message);
      stats.help_requests.failed++;
    }
  }
  
  console.log(`✅ Help Requests: ${stats.help_requests.migrated}/${stats.help_requests.total} migrated`);
}

/**
 * Step 8: Migrate Members
 */
async function migrateMembers() {
  console.log('\n👨‍👩‍👧‍👦 Step 8: Migrating Members...');
  
  const members = await Member.find({}).lean();
  stats.members.total = members.length;
  
  for (const member of members) {
    try {
      const orgUUID = idMap.organizations.get(member.orgId);
      if (!orgUUID) continue;
      
      const { error } = await supabase
        .from('members')
        .insert({
          org_id: orgUUID,
          name: member.name,
          status: member.status || 'UNKNOWN',
          location: member.location,
          last_update: member.lastUpdate,
          needs: member.needs || [],
          phone: member.phone,
          address: member.address,
          emergency_contact_name: member.emergencyContactName,
          emergency_contact_phone: member.emergencyContactPhone,
          emergency_contact_relation: member.emergencyContactRelation,
          created_at: member.createdAt,
          updated_at: member.updatedAt,
        });
      
      if (error) throw error;
      stats.members.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate member:`, error.message);
      stats.members.failed++;
    }
  }
  
  console.log(`✅ Members: ${stats.members.migrated}/${stats.members.total} migrated`);
}

/**
 * Print final statistics
 */
function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  
  Object.entries(stats).forEach(([table, counts]) => {
    const successRate = counts.total > 0 
      ? ((counts.migrated / counts.total) * 100).toFixed(1) 
      : 'N/A';
    console.log(`${table.padEnd(25)} ${counts.migrated}/${counts.total} (${successRate}%) ${counts.failed > 0 ? `⚠️  ${counts.failed} failed` : ''}`);
  });
  
  console.log('='.repeat(60));
  
  const totalMigrated = Object.values(stats).reduce((sum, s) => sum + s.migrated, 0);
  const totalRecords = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);
  
  console.log(`\nTotal: ${totalMigrated}/${totalRecords} records migrated`);
  if (totalFailed > 0) {
    console.log(`⚠️  ${totalFailed} records failed`);
  }
  console.log('\n✅ Migration complete!\n');
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('🚀 Starting AERA MongoDB → Supabase Migration\n');
    
    // Validate environment
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    }
    if (!MONGODB_URI) {
      throw new Error('Missing MONGODB_URI in environment');
    }
    
    // Connect to databases
    await connectMongoDB();
    await validateSupabase();
    
    // Run migration steps
    await migrateOrganizations();
    await migrateUsers();
    await migrateInventory();
    await migrateRequests();
    await migrateMemberStatuses();
    await migrateBroadcasts();
    await migrateHelpRequests();
    await migrateMembers();
    
    // Print results
    printStats();
    
    // Save ID mapping for reference
    const mappingFile = './migration-id-mapping.json';
    const mapping = {
      organizations: Object.fromEntries(idMap.organizations),
      users: Object.fromEntries(idMap.users),
    };
    await import('fs').then(fs => 
      fs.promises.writeFile(mappingFile, JSON.stringify(mapping, null, 2))
    );
    console.log(`💾 ID mapping saved to ${mappingFile}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 MongoDB connection closed');
  }
}

// Run migration
migrate();
