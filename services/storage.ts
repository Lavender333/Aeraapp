
import { HelpRequestData, HelpRequestRecord, UserProfile, OrgMember, OrgInventory, OrganizationProfile, DatabaseSchema, HouseholdMember, ReplenishmentRequest } from '../types';

const DB_KEY = 'aera_backend_db_v1';

// --- Seed Data ---
const SEED_ORGS: OrganizationProfile[] = [
  { 
    id: 'CH-9921', 
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
    currentBroadcast: "Choir practice cancelled. Shelter open in Gym."
  },
  { 
    id: 'NGO-5500', 
    name: 'Regional Aid Network', 
    type: 'NGO', 
    address: '100 Relief Blvd', 
    adminContact: 'Sarah Connor', 
    adminPhone: '555-0102', 
    replenishmentProvider: 'FEMA Region 4', 
    replenishmentEmail: 'logistics@fema.example.gov',
    replenishmentPhone: '555-9001',
    verified: true,
    active: true
  }
];

const SEED_USERS: UserProfile[] = [
  { 
    id: 'u0', fullName: 'System Admin', phone: '555-0000', address: 'HQ', 
    householdMembers: 1, household: [], petDetails: '', medicalNeeds: '', 
    emergencyContactName: 'Ops Center', emergencyContactPhone: '555-9999', emergencyContactRelation: 'Supervisor',
    communityId: '', role: 'ADMIN', language: 'en', active: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u1', fullName: 'Alice Johnson', phone: '555-1001', address: '101 Pine St', 
    householdMembers: 3, 
    household: [
      { id: 'h1', name: 'Bob Johnson', age: '35', needs: '' },
      { id: 'h2', name: 'Timmy Johnson', age: '8', needs: 'Asthma' }
    ],
    petDetails: '1 Cat', medicalNeeds: '', 
    emergencyContactName: 'Bob Johnson', emergencyContactPhone: '555-2001', emergencyContactRelation: 'Spouse',
    communityId: 'CH-9921', role: 'GENERAL_USER', language: 'en', active: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u2', fullName: 'David Brown', phone: '555-1002', address: '202 Oak Ave', 
    householdMembers: 1, household: [], petDetails: '', medicalNeeds: 'Insulin Dependent', 
    emergencyContactName: 'Martha Brown', emergencyContactPhone: '555-2002', emergencyContactRelation: 'Mother',
    communityId: 'CH-9921', role: 'GENERAL_USER', language: 'en', active: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u3', fullName: 'Pastor John', phone: '555-0101', address: '4500 Main St', 
    householdMembers: 4, 
    household: [
      { id: 'h3', name: 'Mary Smith', age: '45', needs: '' },
      { id: 'h4', name: 'Luke Smith', age: '12', needs: '' },
      { id: 'h5', name: 'Mark Smith', age: '10', needs: '' }
    ],
    petDetails: '', medicalNeeds: '', 
    emergencyContactName: 'Church Office', emergencyContactPhone: '555-0100', emergencyContactRelation: 'Work',
    communityId: 'CH-9921', role: 'INSTITUTION_ADMIN', language: 'en', active: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u4', fullName: 'Sarah Connor', phone: '555-9111', address: 'Fire Station 1', 
    householdMembers: 1, household: [], petDetails: '', medicalNeeds: '', 
    emergencyContactName: 'Dispatcher', emergencyContactPhone: '555-9000', emergencyContactRelation: 'Work',
    communityId: '', role: 'FIRST_RESPONDER', language: 'en', active: true, notifications: { push: true, sms: true, email: true }
  }
];

const SEED_INVENTORY: Record<string, OrgInventory> = {
  'CH-9921': { water: 120, food: 45, blankets: 300, medicalKits: 15 },
  'NGO-5500': { water: 5000, food: 2000, blankets: 1000, medicalKits: 500 }
};

const SEED_REPLENISHMENT_REQUESTS: ReplenishmentRequest[] = [
  { id: 'req-1', orgId: 'CH-9921', orgName: 'Grace Community Church', item: 'Water Cases', quantity: 50, status: 'PENDING', timestamp: new Date(Date.now() - 3600000).toISOString(), provider: 'Diocese HQ', synced: true },
  { id: 'req-2', orgId: 'NGO-5500', orgName: 'Regional Aid Network', item: 'Medical Kits', quantity: 200, status: 'FULFILLED', timestamp: new Date(Date.now() - 86400000).toISOString(), provider: 'FEMA Region 4', synced: true }
];

export const StorageService = {
  // --- Core Database Engine ---
  getDB(): DatabaseSchema {
    try {
      const stored = localStorage.getItem(DB_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("DB Load Error", e);
    }
    return this.seedDB();
  },

  saveDB(db: DatabaseSchema) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.error("DB Save Error", e);
    }
  },

  seedDB(): DatabaseSchema {
    const db: DatabaseSchema = {
      users: SEED_USERS,
      organizations: SEED_ORGS,
      inventories: SEED_INVENTORY,
      requests: [],
      replenishmentRequests: SEED_REPLENISHMENT_REQUESTS,
      currentUser: null,
      tickerMessage: "" // Default system ticker empty
    };
    this.saveDB(db);
    return db;
  },

  resetDB() {
    localStorage.removeItem(DB_KEY);
    window.location.reload();
  },

  // --- Profile / Auth ---
  hasProfile(): boolean {
    const db = this.getDB();
    return !!db.currentUser;
  },

  getProfile(): UserProfile {
    const db = this.getDB();
    if (!db.currentUser) return this.createGuestProfile();
    
    const user = db.users.find(u => u.id === db.currentUser);
    return user || this.createGuestProfile();
  },

  createGuestProfile(): UserProfile {
    return {
      id: 'guest',
      fullName: '',
      phone: '',
      address: '',
      householdMembers: 1,
      household: [],
      petDetails: '',
      medicalNeeds: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      communityId: '',
      role: 'GENERAL_USER',
      language: 'en',
      active: true,
      notifications: { push: true, sms: true, email: true }
    };
  },

  saveProfile(profile: UserProfile): boolean {
    const db = this.getDB();
    
    // Ensure ID
    if (!profile.id || profile.id === 'guest') {
      profile.id = 'u_' + Date.now();
    }
    
    // Sync legacy count
    profile.householdMembers = (profile.household?.length || 0) + 1; // +1 for self
    
    // Default active to true if not specified
    if (profile.active === undefined) {
      profile.active = true;
    }

    const index = db.users.findIndex(u => u.id === profile.id);
    if (index >= 0) {
      db.users[index] = profile;
    } else {
      db.users.push(profile);
    }
    
    // Set as current session
    db.currentUser = profile.id;
    this.saveDB(db);
    return true;
  },

  loginUser(phone: string): { success: boolean, message?: string } {
    const db = this.getDB();
    // Simple matching by phone number
    const user = db.users.find(u => u.phone === phone);
    
    if (user) {
      if (user.active === false) {
        return { success: false, message: 'Account deactivated. Contact Admin.' };
      }
      db.currentUser = user.id;
      this.saveDB(db);
      return { success: true };
    }
    return { success: false, message: 'User not found. Please check number or register.' };
  },

  logoutUser() {
    const db = this.getDB();
    db.currentUser = null;
    this.saveDB(db);
  },
  
  // --- Admin User Management ---
  updateUserStatus(userId: string, active: boolean) {
    const db = this.getDB();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx >= 0) {
      // Prevent deactivating self if currently logged in
      if (db.currentUser === userId && !active) {
        alert("Cannot deactivate your own account while logged in.");
        return;
      }
      db.users[idx].active = active;
      this.saveDB(db);
    }
  },

  // --- Org Management ---
  saveOrganization(org: OrganizationProfile): boolean {
    const db = this.getDB();
    
    // Ensure active status
    if (org.active === undefined) org.active = true;

    // Save Org
    const idx = db.organizations.findIndex(o => o.id === org.id);
    if (idx >= 0) db.organizations[idx] = org;
    else db.organizations.push(org);

    // Initialize Inventory
    if (!db.inventories[org.id]) {
      db.inventories[org.id] = { water: 0, food: 0, blankets: 0, medicalKits: 0 };
    }

    // Update Current User to be Admin of this Org
    if (db.currentUser) {
      const userIdx = db.users.findIndex(u => u.id === db.currentUser);
      if (userIdx >= 0) {
        db.users[userIdx].role = 'INSTITUTION_ADMIN';
        db.users[userIdx].communityId = org.id;
      }
    }

    this.saveDB(db);
    return true;
  },
  
  updateOrgStatus(orgId: string, active: boolean) {
    const db = this.getDB();
    const idx = db.organizations.findIndex(o => o.id === orgId);
    if (idx >= 0) {
      db.organizations[idx].active = active;
      this.saveDB(db);
    }
  },

  generateOrgId(type: string): string {
    const prefix = type === 'CHURCH' ? 'CH' : type === 'NGO' ? 'NGO' : 'ORG';
    const randomNum = Math.floor(1000 + Math.random() * 9000); 
    return `${prefix}-${randomNum}`;
  },

  getOrganization(id: string): OrganizationProfile | null {
    const db = this.getDB();
    return db.organizations.find(o => o.id === id) || null;
  },

  getAllOrganizations(): OrganizationProfile[] {
    const db = this.getDB();
    return db.organizations;
  },

  getOrgInventory(orgId: string): OrgInventory {
    const db = this.getDB();
    return db.inventories[orgId] || { water: 0, food: 0, blankets: 0, medicalKits: 0 };
  },

  updateOrgInventory(orgId: string, inventory: OrgInventory) {
    const db = this.getDB();
    db.inventories[orgId] = inventory;
    this.saveDB(db);
  },

  // --- Replenishment Requests ---
  submitReplenishmentRequest(orgId: string, item: string, quantity: number): boolean {
    const db = this.getDB();
    const org = db.organizations.find(o => o.id === orgId);
    if (!org) return false;

    // Check Online Status for Sync
    const isOnline = navigator.onLine;

    const request: ReplenishmentRequest = {
      id: 'RR-' + Date.now(),
      orgId: org.id,
      orgName: org.name,
      item: item,
      quantity: quantity,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      provider: org.replenishmentProvider || 'Unknown',
      synced: isOnline // Track sync status
    };

    if (!db.replenishmentRequests) db.replenishmentRequests = [];
    db.replenishmentRequests.unshift(request);
    this.saveDB(db);
    return true;
  },

  getAllReplenishmentRequests(): ReplenishmentRequest[] {
    const db = this.getDB();
    return db.replenishmentRequests || [];
  },

  updateReplenishmentRequestStatus(id: string, status: 'PENDING' | 'APPROVED' | 'FULFILLED') {
    const db = this.getDB();
    const idx = db.replenishmentRequests.findIndex(r => r.id === id);
    if (idx >= 0) {
      db.replenishmentRequests[idx].status = status;
      this.saveDB(db);
    }
  },

  signReplenishmentRequest(id: string, signatureData: string, type: 'RELEASE' | 'RECEIVE' = 'RELEASE') {
    const db = this.getDB();
    const idx = db.replenishmentRequests.findIndex(r => r.id === id);
    if (idx >= 0) {
      if (type === 'RELEASE') {
        db.replenishmentRequests[idx].signature = signatureData;
        db.replenishmentRequests[idx].signedAt = new Date().toISOString();
      } else if (type === 'RECEIVE') {
        db.replenishmentRequests[idx].receivedSignature = signatureData;
        db.replenishmentRequests[idx].receivedAt = new Date().toISOString();
      }
      this.saveDB(db);
    }
  },

  // --- Backend Queries (Relational) ---
  getOrgMembers(orgId: string): OrgMember[] {
    const db = this.getDB();
    
    // 1. Find all users linked to this org
    const linkedUsers = db.users.filter(u => u.communityId === orgId);

    // 2. Map to OrgMember format, joining with their latest Request
    return linkedUsers.map(user => {
      // Find latest request for this user
      const userRequests = db.requests
        .filter(r => r.userId === user.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const latestReq = userRequests[0];

      let status: 'SAFE' | 'DANGER' | 'UNKNOWN' = 'UNKNOWN';
      let needs: string[] = [];
      let lastUpdate = 'Never';
      let location = 'Unknown';

      if (latestReq) {
        status = latestReq.isSafe ? 'SAFE' : 'DANGER';
        lastUpdate = new Date(latestReq.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        location = latestReq.location;
        
        if (latestReq.hasFood === false) needs.push('Food');
        if (latestReq.hasWater === false) needs.push('Water');
        if (latestReq.isInjured) needs.push('Medical');
        if (!latestReq.isSafe) needs.push('Rescue');
      }

      return {
        id: user.id,
        name: user.fullName,
        status,
        lastUpdate,
        location,
        needs,
        phone: user.phone,
        address: user.address,
        emergencyContactName: user.emergencyContactName || '',
        emergencyContactPhone: user.emergencyContactPhone || '',
        emergencyContactRelation: user.emergencyContactRelation || ''
      };
    });
  },

  // --- Help Requests ---
  submitRequest(data: HelpRequestData): HelpRequestRecord {
    const db = this.getDB();
    const currentUser = db.currentUser || 'guest';
    const priority = this.calculatePriority(data);
    const isOnline = navigator.onLine;

    const record: HelpRequestRecord = {
      ...data,
      id: Date.now().toString(),
      userId: currentUser,
      timestamp: new Date().toISOString(),
      status: 'RECEIVED',
      priority: priority,
      synced: isOnline // Track sync status
    };

    db.requests.unshift(record);
    
    // Also clear any pending status request
    const userIdx = db.users.findIndex(u => u.id === currentUser);
    if (userIdx >= 0 && db.users[userIdx].pendingStatusRequest) {
      delete db.users[userIdx].pendingStatusRequest;
    }

    this.saveDB(db);
    return record;
  },

  updateRequestLocation(requestId: string, location: string) {
    const db = this.getDB();
    const reqIdx = db.requests.findIndex(r => r.id === requestId);
    if (reqIdx >= 0) {
      db.requests[reqIdx].location = location;
      this.saveDB(db);
    }
  },

  getActiveRequest(): HelpRequestRecord | null {
    const db = this.getDB();
    if (!db.currentUser) return null;
    
    // Find latest request for current user
    const userRequests = db.requests.filter(r => r.userId === db.currentUser);
    return userRequests.length > 0 ? userRequests[0] : null;
  },

  calculatePriority(data: HelpRequestData): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (data.emergencyType === 'Medical' || data.emergencyType === 'Fire' || data.isInjured) return 'CRITICAL';
    if (data.emergencyType === 'Flood' || !data.canEvacuate || data.vulnerableGroups.length > 0) return 'HIGH';
    if (data.hazardsPresent || !data.hasPower || !data.hasWater) return 'MEDIUM';
    return 'LOW';
  },

  // --- Ping / Status Checks ---
  sendPing(targetUserId: string): boolean {
    const db = this.getDB();
    const currentUser = db.users.find(u => u.id === db.currentUser);
    const targetIdx = db.users.findIndex(u => u.id === targetUserId);
    
    if (targetIdx >= 0 && currentUser) {
      db.users[targetIdx].pendingStatusRequest = {
        requesterName: currentUser.fullName,
        timestamp: new Date().toISOString()
      };
      this.saveDB(db);
      return true;
    }
    return false;
  },

  respondToPing(isSafe: boolean) {
    const db = this.getDB();
    if (!db.currentUser) return;
    
    const currentUser = db.currentUser;
    const isOnline = navigator.onLine;

    const record: HelpRequestRecord = {
      isSafe: isSafe,
      location: 'Status Check Response',
      emergencyType: isSafe ? 'Check-in' : 'General Emergency',
      isInjured: false,
      injuryDetails: '',
      situationDescription: 'Response to Institution Status Check',
      canEvacuate: null,
      hazardsPresent: null,
      hazardDetails: '',
      peopleCount: 1,
      petsPresent: null,
      hasWater: null,
      hasFood: null,
      hasMeds: null,
      hasPower: null,
      hasPhone: true,
      needsTransport: null,
      vulnerableGroups: [],
      medicalConditions: '',
      damageType: '',
      consentToShare: true,
      id: Date.now().toString(),
      userId: currentUser,
      timestamp: new Date().toISOString(),
      status: 'RECEIVED',
      priority: isSafe ? 'LOW' : 'HIGH',
      synced: isOnline
    };

    db.requests.unshift(record);
    
    const userIdx = db.users.findIndex(u => u.id === currentUser);
    if (userIdx >= 0) {
      delete db.users[userIdx].pendingStatusRequest;
    }

    this.saveDB(db);
  },

  // --- Ticker / Broadcast (Scoped) ---
  getTicker(userProfile?: UserProfile): string {
    const db = this.getDB();
    
    // 1. Priority: System-wide Message (from Admin)
    if (db.tickerMessage && db.tickerMessage.length > 5) {
      return `[SYSTEM ALERT] ${db.tickerMessage}`;
    }

    // 2. Organization Message (if user is linked)
    if (userProfile && userProfile.communityId) {
      const org = db.organizations.find(o => o.id === userProfile.communityId);
      if (org && org.currentBroadcast) {
        return `[${org.name} Update] ${org.currentBroadcast}`;
      }
    }

    // 3. Default Fallback
    return "Evacuation Order in Zone 4 • Shelter capacity at 85% • High water levels reported on Main St. •";
  },

  updateSystemTicker(message: string) {
    const db = this.getDB();
    db.tickerMessage = message;
    this.saveDB(db);
    window.dispatchEvent(new Event('ticker-update'));
  },

  updateOrgBroadcast(orgId: string, message: string) {
    const db = this.getDB();
    const idx = db.organizations.findIndex(o => o.id === orgId);
    if (idx >= 0) {
      db.organizations[idx].currentBroadcast = message;
      db.organizations[idx].lastBroadcastTime = new Date().toISOString();
      this.saveDB(db);
      window.dispatchEvent(new Event('ticker-update'));
    }
  },
  
  clearOrgBroadcast(orgId: string) {
    const db = this.getDB();
    const idx = db.organizations.findIndex(o => o.id === orgId);
    if (idx >= 0) {
      db.organizations[idx].currentBroadcast = undefined;
      this.saveDB(db);
      window.dispatchEvent(new Event('ticker-update'));
    }
  },

  // --- Offline Sync Logic ---
  async syncPendingData(): Promise<number> {
    const db = this.getDB();
    let count = 0;

    // 1. Sync Help Requests
    db.requests = db.requests.map(r => {
      if (r.synced === false) {
        count++;
        return { ...r, synced: true };
      }
      return r;
    });

    // 2. Sync Replenishment Requests
    if (db.replenishmentRequests) {
      db.replenishmentRequests = db.replenishmentRequests.map(r => {
        if (r.synced === false) {
          count++;
          return { ...r, synced: true };
        }
        return r;
      });
    }

    if (count > 0) {
      // Simulate network latency for realism
      await new Promise(resolve => setTimeout(resolve, 1500));
      this.saveDB(db);
      // Notify components that data has updated
      window.dispatchEvent(new Event('storage'));
    }
    
    return count;
  }
};
