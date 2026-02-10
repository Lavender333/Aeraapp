
import { HelpRequestData, HelpRequestRecord, UserProfile, OrgMember, OrgInventory, OrganizationProfile, DatabaseSchema, HouseholdMember, ReplenishmentRequest, RoleDefinition } from '../types';
import { REQUEST_ITEM_MAP } from './validation';
import { getInventory, saveInventory, getBroadcast, setBroadcast, createHelpRequest, getActiveHelpRequest, updateHelpRequestLocation, listMembers, addMember, updateMember, removeMember, registerAuth, loginAuth, forgotPassword, resetPassword } from './api';
import { getMemberStatus, setMemberStatus } from './api';

const DB_KEY = 'aera_backend_db_v4'; // Force fresh database
const AUTH_TOKEN_KEY = 'aera_auth_token';
const AUTH_REFRESH_TOKEN_KEY = 'aera_refresh_token';
const OFFLINE_QUEUE_KEY = 'aera_offline_queue_v1';
const SYNC_ID_MAP_KEY = 'aera_sync_id_map_v1';
const STORAGE_STATE_KEY = 'aera_storage_state_v1';
const ROLE_DEFINITIONS_KEY = 'aera_role_definitions_v1';
const MAX_CACHED_REQUESTS = 200;
const MAX_CACHED_REPLENISHMENTS = 200;
const IS_PRODUCTION = import.meta.env.PROD;

type OfflineOperation = {
  id: string;
  type: 'createHelpRequest' | 'updateHelpRequestLocation';
  timestamp: string;
  localRequestId?: string;
  payload: any;
};

const isQuotaExceeded = (error: unknown) => {
  const err = error as { name?: string; code?: number; message?: string };
  return (
    err?.name === 'QuotaExceededError' ||
    err?.code === 22 ||
    err?.code === 1014 ||
    (err?.message || '').toLowerCase().includes('quota')
  );
};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage getItem failed', { key, error: e });
    return null;
  }
};

const safeSetItem = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (isQuotaExceeded(e)) {
      console.warn('localStorage quota exceeded, will attempt cleanup', { key });
      return false;
    }
    console.error('localStorage setItem failed', { key, error: e });
    return false;
  }
};

const safeRemoveItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('localStorage removeItem failed', { key, error: e });
  }
};

const pruneDatabaseForStorage = (db: DatabaseSchema): DatabaseSchema => {
  return {
    ...db,
    orgMembers: {},
    requests: (db.requests || []).slice(0, MAX_CACHED_REQUESTS),
    replenishmentRequests: (db.replenishmentRequests || []).slice(0, MAX_CACHED_REPLENISHMENTS),
  };
};

const saveStorageState = (state: { degraded: boolean; lastError?: string }) => {
  safeSetItem(STORAGE_STATE_KEY, JSON.stringify({
    ...state,
    timestamp: new Date().toISOString(),
  }));
};

const sanitizeInventory = (inventory: OrgInventory): OrgInventory => ({
  water: Math.max(0, Number(inventory.water) || 0),
  food: Math.max(0, Number(inventory.food) || 0),
  blankets: Math.max(0, Number(inventory.blankets) || 0),
  medicalKits: Math.max(0, Number(inventory.medicalKits) || 0),
});

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
    registeredPopulation: 200,
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
    active: true,
    registeredPopulation: 1200
  }
];

const SEED_USERS: UserProfile[] = [
  { 
    id: 'u0', fullName: 'System Admin', email: 'admin@example.com', phone: '555-0000', address: 'HQ', 
    householdMembers: 1, household: [], petDetails: '', medicalNeeds: '', 
    emergencyContactName: 'Ops Center', emergencyContactPhone: '555-9999', emergencyContactRelation: 'Supervisor',
    communityId: '', role: 'ADMIN', language: 'en', active: true, onboardComplete: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u1', fullName: 'Alice Johnson', email: 'alice@example.com', phone: '555-1001', address: '101 Pine St', 
    householdMembers: 3, 
    household: [
      { id: 'h1', name: 'Bob Johnson', age: '35', needs: '' },
      { id: 'h2', name: 'Timmy Johnson', age: '8', needs: 'Asthma' }
    ],
    petDetails: '1 Cat', medicalNeeds: '', 
    emergencyContactName: 'Bob Johnson', emergencyContactPhone: '555-2001', emergencyContactRelation: 'Spouse',
    communityId: 'CH-9921', role: 'GENERAL_USER', language: 'en', active: true, onboardComplete: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u2', fullName: 'David Brown', email: 'david@example.com', phone: '555-1002', address: '202 Oak Ave', 
    householdMembers: 1, household: [], petDetails: '', medicalNeeds: 'Insulin Dependent', 
    emergencyContactName: 'Martha Brown', emergencyContactPhone: '555-2002', emergencyContactRelation: 'Mother',
    communityId: 'CH-9921', role: 'GENERAL_USER', language: 'en', active: true, onboardComplete: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u3', fullName: 'Pastor John', email: 'pastor@example.com', phone: '555-0101', address: '4500 Main St', 
    householdMembers: 4, 
    household: [
      { id: 'h3', name: 'Mary Smith', age: '45', needs: '' },
      { id: 'h4', name: 'Luke Smith', age: '12', needs: '' },
      { id: 'h5', name: 'Mark Smith', age: '10', needs: '' }
    ],
    petDetails: '', medicalNeeds: '', 
    emergencyContactName: 'Church Office', emergencyContactPhone: '555-0100', emergencyContactRelation: 'Work',
    communityId: 'CH-9921', role: 'INSTITUTION_ADMIN', language: 'en', active: true, onboardComplete: true, notifications: { push: true, sms: true, email: true }
  },
  { 
    id: 'u4', fullName: 'Sarah Connor', email: 'sarah@example.com', phone: '555-9111', address: 'Fire Station 1', 
    householdMembers: 1, household: [], petDetails: '', medicalNeeds: '', 
    emergencyContactName: 'Dispatcher', emergencyContactPhone: '555-9000', emergencyContactRelation: 'Work',
    communityId: '', role: 'FIRST_RESPONDER', language: 'en', active: true, onboardComplete: true, notifications: { push: true, sms: true, email: true }
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
      const stored = safeGetItem(DB_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.orgMembers) parsed.orgMembers = {};
        return parsed;
      }
    } catch (e) {
      console.error("DB Load Error", e);
    }
    return this.seedDB();
  },

  saveDB(db: DatabaseSchema) {
    try {
      const saved = safeSetItem(DB_KEY, JSON.stringify(db));
      if (!saved) {
        const pruned = pruneDatabaseForStorage(db);
        const prunedSaved = safeSetItem(DB_KEY, JSON.stringify(pruned));
        if (!prunedSaved) {
          saveStorageState({ degraded: true, lastError: 'Unable to persist after pruning' });
          console.error('DB Save Error: Unable to persist even after pruning');
        } else {
          saveStorageState({ degraded: true, lastError: 'Pruned database due to quota limits' });
        }
      } else {
        saveStorageState({ degraded: false });
      }
    } catch (e) {
      saveStorageState({ degraded: true, lastError: String(e) });
      console.error("DB Save Error", e);
    }
  },

  getStorageState(): { degraded: boolean; lastError?: string; timestamp?: string } {
    const raw = safeGetItem(STORAGE_STATE_KEY);
    if (!raw) return { degraded: false };
    try {
      const parsed = JSON.parse(raw);
      return parsed || { degraded: false };
    } catch {
      return { degraded: false };
    }
  },

  shouldUseBackendAsSourceOfTruth(): boolean {
    const state = this.getStorageState();
    return !!state.degraded;
  },

  getSyncIdMap(): Record<string, string> {
    const raw = safeGetItem(SYNC_ID_MAP_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse sync id map', e);
      return {};
    }
  },

  saveSyncIdMap(map: Record<string, string>) {
    safeSetItem(SYNC_ID_MAP_KEY, JSON.stringify(map));
  },

  seedDB(): DatabaseSchema {
    console.log('Seeding database with users:', SEED_USERS.map(u => ({ id: u.id, name: u.fullName, onboardComplete: u.onboardComplete })));
    const db: DatabaseSchema = {
      users: SEED_USERS,
      organizations: SEED_ORGS,
      inventories: SEED_INVENTORY,
      requests: [],
      replenishmentRequests: SEED_REPLENISHMENT_REQUESTS,
      orgMembers: {},
      currentUser: null,
      tickerMessage: "" // Default system ticker empty
    };
    this.saveDB(db);
    return db;
  },

  resetDB() {
    safeRemoveItem(DB_KEY);
    safeRemoveItem(AUTH_TOKEN_KEY);
    safeRemoveItem(AUTH_REFRESH_TOKEN_KEY);
    window.location.reload();
  },

  // --- Role Definitions ---
  getRoles(): RoleDefinition[] | null {
    const raw = safeGetItem(ROLE_DEFINITIONS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RoleDefinition[]) : null;
    } catch (e) {
      console.warn('Failed to parse role definitions', e);
      return null;
    }
  },

  saveRoles(roles: RoleDefinition[]) {
    safeSetItem(ROLE_DEFINITIONS_KEY, JSON.stringify(roles));
  },

  // --- Profile / Auth ---
  setAuthToken(token: string) {
    safeSetItem(AUTH_TOKEN_KEY, token);
  },

  setRefreshToken(token: string) {
    safeSetItem(AUTH_REFRESH_TOKEN_KEY, token);
  },

  getAuthToken(): string | null {
    return safeGetItem(AUTH_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return safeGetItem(AUTH_REFRESH_TOKEN_KEY);
  },

  clearAuthToken() {
    safeRemoveItem(AUTH_TOKEN_KEY);
    safeRemoveItem(AUTH_REFRESH_TOKEN_KEY);
  },

  getOfflineQueue(): OfflineOperation[] {
    const raw = safeGetItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse offline queue', e);
      return [];
    }
  },

  saveOfflineQueue(queue: OfflineOperation[]) {
    safeSetItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  enqueueOfflineOperation(op: Omit<OfflineOperation, 'id' | 'timestamp'>) {
    const queue = this.getOfflineQueue();
    const operation: OfflineOperation = {
      ...op,
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    if (operation.type === 'updateHelpRequestLocation' && operation.payload?.requestId) {
      const existingIdx = queue.findIndex(
        (q) => q.type === 'updateHelpRequestLocation' && q.payload?.requestId === operation.payload.requestId
      );
      if (existingIdx >= 0) {
        queue[existingIdx] = operation;
        this.saveOfflineQueue(queue);
        return;
      }
    }

    queue.push(operation);
    this.saveOfflineQueue(queue);
  },

  startOfflineSyncListener() {
    if (typeof window === 'undefined') return;
    const flag = '__aera_offline_sync_listener__';
    if ((window as any)[flag]) return;
    (window as any)[flag] = true;
    window.addEventListener('online', () => {
      this.syncPendingData().catch((e) => console.warn('Offline sync failed', e));
    });
  },

  async registerWithCredentials(email: string, password: string, fullName?: string) {
    const resp = await registerAuth({ email, password, fullName });
    if (resp?.token) this.setAuthToken(resp.token);
    if (resp?.refreshToken) this.setRefreshToken(resp.refreshToken);
    if (resp?.user) {
      const profile: UserProfile = {
        id: resp.user.id,
        fullName: resp.user.fullName || fullName || '',
        email: resp.user.email || '',
        phone: resp.user.phone || '',
        address: '',
        householdMembers: 1,
        household: [],
        petDetails: '',
        medicalNeeds: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        communityId: resp.user.orgId || '',
        role: resp.user.role || 'GENERAL_USER',
        language: 'en',
        active: true,
        onboardComplete: false,
        notifications: { push: true, sms: true, email: true }
      };
      this.saveProfile(profile);
    }
    return resp;
  },

  async loginWithCredentials(email: string, password: string) {
    const db = this.getDB();
    if (!IS_PRODUCTION) {
      // Try local database first (for demo/offline mode)
      const user = db.users.find(u => u.email === email);
      if (user) {
        if (user.active === false) {
          throw new Error('Account deactivated. Contact Admin.');
        }
        db.currentUser = user.id;
        this.saveDB(db);
        return { 
          token: 'local-demo-token', 
          user: { 
            id: user.id, 
            email: user.email, 
            fullName: user.fullName, 
            role: user.role,
            onboardComplete: user.onboardComplete 
          } 
        };
      }
    }

    // Supabase auth
    try {
      const resp = await loginAuth({ email, password });
      if (resp?.token) this.setAuthToken(resp.token);
      if (resp?.refreshToken) this.setRefreshToken(resp.refreshToken);
      if (resp?.user) {
        const profile: UserProfile = {
          id: resp.user.id,
          fullName: resp.user.fullName || '',
          email: resp.user.email || '',
          phone: resp.user.phone || '',
          address: '',
          householdMembers: 1,
          household: [],
          petDetails: '',
          medicalNeeds: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          emergencyContactRelation: '',
          communityId: resp.user.orgId || '',
          role: resp.user.role || 'GENERAL_USER',
          language: 'en',
          active: true,
          onboardComplete: false,
          notifications: { push: true, sms: true, email: true }
        };
        this.saveProfile(profile);
      }
      return resp;
    } catch (err: any) {
      const message = err?.message || 'Login failed. Please check your credentials.';
      throw new Error(message);
    }
  },

  async requestPasswordReset(email: string) {
    return forgotPassword({ email });
  },

  async resetPassword(email: string, token: string, newPassword: string) {
    return resetPassword({ email, token, newPassword });
  },

  hasProfile(): boolean {
    const db = this.getDB();
    return !!db.currentUser;
  },

  getProfile(): UserProfile {
    const db = this.getDB();
    console.log('getProfile called, currentUser:', db.currentUser);
    if (!db.currentUser) return this.createGuestProfile();
    
    const user = db.users.find(u => u.id === db.currentUser);
    console.log('Found user profile:', user ? { id: user.id, name: user.fullName, onboardComplete: user.onboardComplete } : 'NOT FOUND');
    return user || this.createGuestProfile();
  },

  createGuestProfile(): UserProfile {
    return {
      id: 'guest',
      fullName: '',
      email: '',
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
    if (profile.onboardComplete === undefined) {
      profile.onboardComplete = false;
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
    
    console.log('loginUser called with phone:', phone);
    console.log('Found user:', user ? { id: user.id, name: user.fullName, onboardComplete: user.onboardComplete } : 'NOT FOUND');
    
    if (user) {
      if (user.active === false) {
        return { success: false, message: 'Account deactivated. Contact Admin.' };
      }
      db.currentUser = user.id;
      this.saveDB(db);
      console.log('User logged in, currentUser set to:', user.id);
      return { success: true };
    }
    return { success: false, message: 'User not found. Please check number or register.' };
  },

  logoutUser() {
    const db = this.getDB();
    db.currentUser = null;
    this.saveDB(db);
    safeRemoveItem(AUTH_TOKEN_KEY);
    safeRemoveItem(AUTH_REFRESH_TOKEN_KEY);
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

  async fetchOrgInventoryRemote(orgId: string): Promise<{ inventory: OrgInventory, fromCache: boolean }> {
    try {
      const inventory = await getInventory(orgId);
      return { inventory, fromCache: false };
    } catch (e) {
      console.warn('API inventory fetch failed, falling back to local', e);
      return { inventory: this.getOrgInventory(orgId), fromCache: true };
    }
  },

  async saveOrgInventoryRemote(orgId: string, inventory: OrgInventory): Promise<boolean> {
    try {
      const sanitized = sanitizeInventory(inventory);
      await saveInventory(orgId, sanitized);
      // cache locally too
      this.saveOrgInventory(orgId, sanitized);
      return true;
    } catch (e) {
      console.warn('API inventory save failed, keeping local only', e);
      return false;
    }
  },

  async fetchMemberStatus(orgId: string) {
    try {
      return await getMemberStatus(orgId);
    } catch (e) {
      console.warn('API member status fetch failed', e);
      return null;
    }
  },

  async saveMemberStatus(orgId: string, memberId: string, name: string, status: 'SAFE' | 'DANGER' | 'UNKNOWN') {
    try {
      return await setMemberStatus(orgId, { memberId, name, status });
    } catch (e) {
      console.warn('API member status save failed', e);
      return null;
    }
  },

  updateOrgInventory(orgId: string, inventory: OrgInventory) {
    const db = this.getDB();
    const sanitized = sanitizeInventory(inventory);

    db.inventories[orgId] = sanitized;
    this.saveDB(db);
    // broadcast inventory update for listeners (dashboard refresh)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('inventory-update'));
    }
  },

  // --- Replenishment Requests ---
  submitReplenishmentRequest(orgId: string, item: string, quantity: number): boolean {
    const db = this.getDB();
    const org = db.organizations.find(o => o.id === orgId);
    if (!org) return false;

    if (!REQUEST_ITEM_MAP[item]) return false;
    const inventoryKey = REQUEST_ITEM_MAP[item];

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

  // Compatibility wrapper used by UI fallback code
  createReplenishmentRequest(orgId: string, payload: { item: string; quantity: number; provider?: string; orgName?: string }): boolean {
    const db = this.getDB();
    const org = db.organizations.find(o => o.id === orgId);
    if (!org) return false;

    const isOnline = navigator.onLine;
    const request = {
      id: 'RR-' + Date.now(),
      orgId: org.id,
      orgName: payload.orgName || org.name,
      item: payload.item,
      quantity: payload.quantity,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      provider: payload.provider || org.replenishmentProvider || 'Unknown',
      synced: isOnline
    } as any;

    if (!db.replenishmentRequests) db.replenishmentRequests = [];
    db.replenishmentRequests.unshift(request);
    this.saveDB(db);
    return true;
  },

  getAllReplenishmentRequests(): ReplenishmentRequest[] {
    const db = this.getDB();
    return db.replenishmentRequests || [];
  },

  getReplenishmentAggregation(): ReplenishmentAggregate[] {
    const db = this.getDB();
    const requests = db.replenishmentRequests || [];
    const map: Record<string, ReplenishmentAggregate> = {};

    requests.forEach(req => {
      if (!map[req.item]) {
        map[req.item] = {
          item: req.item,
          pending: 0,
          approved: 0,
          fulfilled: 0,
          totalRequested: 0,
          pendingQuantity: 0,
        };
      }
      const agg = map[req.item];
      agg.totalRequested += req.quantity || 0;
      if (req.status === 'PENDING') {
        agg.pending += 1;
        agg.pendingQuantity += req.quantity || 0;
      } else if (req.status === 'APPROVED') {
        agg.approved += 1;
        agg.pendingQuantity += req.quantity || 0;
      } else if (req.status === 'FULFILLED' || req.status === 'STOCKED') {
        agg.fulfilled += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.pendingQuantity - a.pendingQuantity);
  },

  getOrgReplenishmentRequests(orgId: string): ReplenishmentRequest[] {
    const db = this.getDB();
    const requests = db.replenishmentRequests || [];
    return requests
      .filter(r => r.orgId === orgId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  fulfillReplenishmentRequest(
    requestId: string,
    delivered: Partial<OrgInventory>,
    status: 'FULFILLED' | 'APPROVED' = 'FULFILLED',
    orgConfirmed: boolean = false
  ) {
    const db = this.getDB();
    const reqIdx = db.replenishmentRequests.findIndex(r => r.id === requestId);
    if (reqIdx === -1) return false;

    const request = db.replenishmentRequests[reqIdx];
    db.replenishmentRequests[reqIdx].status = status;
    db.replenishmentRequests[reqIdx].fulfilledAt = new Date().toISOString();
    db.replenishmentRequests[reqIdx].orgConfirmed = orgConfirmed;
    if (orgConfirmed) {
      db.replenishmentRequests[reqIdx].orgConfirmedAt = new Date().toISOString();
      const existing = this.getOrgInventory(request.orgId);
      const updatedInventory: OrgInventory = {
        water: existing.water + (Number(delivered.water) || 0),
        food: existing.food + (Number(delivered.food) || 0),
        blankets: existing.blankets + (Number(delivered.blankets) || 0),
        medicalKits: existing.medicalKits + (Number(delivered.medicalKits) || 0)
      };
      this.updateOrgInventory(request.orgId, updatedInventory);
    }
    this.saveDB(db);
    return true;
  },

  stockReplenishmentRequest(
    requestId: string,
    delivered: Partial<OrgInventory>
  ) {
    const db = this.getDB();
    const reqIdx = db.replenishmentRequests.findIndex(r => r.id === requestId);
    if (reqIdx === -1) return false;

    const request = db.replenishmentRequests[reqIdx];
    const existing = this.getOrgInventory(request.orgId);

    const updatedInventory: OrgInventory = {
      water: existing.water + (Number(delivered.water) || 0),
      food: existing.food + (Number(delivered.food) || 0),
      blankets: existing.blankets + (Number(delivered.blankets) || 0),
      medicalKits: existing.medicalKits + (Number(delivered.medicalKits) || 0)
    };

    db.replenishmentRequests[reqIdx].stocked = true;
    db.replenishmentRequests[reqIdx].stockedAt = new Date().toISOString();
    db.replenishmentRequests[reqIdx].stockedQuantity = Object.values(delivered).reduce((sum, v) => sum + (Number(v) || 0), 0);
    db.replenishmentRequests[reqIdx].status = 'STOCKED';
    this.updateOrgInventory(request.orgId, updatedInventory);
    this.saveDB(db);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('inventory-update'));
    }
    return true;
  },

  // Alias used by UI fallback
  stockReplenishment(requestId: string, delivered: Partial<OrgInventory>) {
    return this.stockReplenishmentRequest(requestId, delivered as any);
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
  getOrgMembersLocal(orgId: string): OrgMember[] {
    const db = this.getDB();
    const linkedUsers = db.users.filter(u => u.communityId === orgId);

    return linkedUsers.map(user => {
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

  getOrgMembers(orgId: string): OrgMember[] {
    const db = this.getDB();
    if (db.orgMembers && db.orgMembers[orgId]) return db.orgMembers[orgId];
    return this.getOrgMembersLocal(orgId);
  },

  async fetchOrgMembersRemote(orgId: string): Promise<{ members: OrgMember[]; fromCache: boolean }> {
    try {
      const res = await listMembers(orgId);
      const mapped: OrgMember[] = res.map((m: any) => ({
        id: m.id || m._id,
        name: m.name,
        status: m.status || 'UNKNOWN',
        lastUpdate: m.lastUpdate || '',
        location: m.location || 'Unknown',
        needs: m.needs || [],
        phone: m.phone || '',
        address: m.address || '',
        emergencyContactName: m.emergencyContactName || '',
        emergencyContactPhone: m.emergencyContactPhone || '',
        emergencyContactRelation: m.emergencyContactRelation || ''
      }));
      const db = this.getDB();
      db.orgMembers = db.orgMembers || {};
      db.orgMembers[orgId] = mapped;
      this.saveDB(db);
      return { members: mapped, fromCache: false };
    } catch (e) {
      console.warn('API members fetch failed, falling back to local', e);
      return { members: this.getOrgMembersLocal(orgId), fromCache: true };
    }
  },

  async addOrgMemberRemote(orgId: string, payload: Partial<OrgMember>) {
    const created = await addMember(orgId, payload);
    await this.fetchOrgMembersRemote(orgId);
    return created;
  },

  async updateOrgMemberRemote(orgId: string, memberId: string, payload: Partial<OrgMember>) {
    const updated = await updateMember(orgId, memberId, payload);
    await this.fetchOrgMembersRemote(orgId);
    return updated;
  },

  async deleteOrgMemberRemote(orgId: string, memberId: string) {
    await removeMember(orgId, memberId);
    const db = this.getDB();
    db.orgMembers = db.orgMembers || {};
    db.orgMembers[orgId] = (db.orgMembers[orgId] || []).filter((m: OrgMember) => m.id !== memberId);
    this.saveDB(db);
  },

  // --- Help Requests ---
  async submitRequest(data: HelpRequestData): Promise<HelpRequestRecord> {
    const db = this.getDB();
    const currentUser = db.currentUser || 'guest';
    const priority = this.calculatePriority(data);
    const isOnline = navigator.onLine;

    const clientId = Date.now().toString();
    const record: HelpRequestRecord = {
      ...data,
      id: clientId,
      clientId,
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

    const profile = db.users.find(u => u.id === currentUser);
    const requestPayload = {
      orgId: profile?.communityId,
      data,
      priority,
      location: data.location,
      status: 'RECEIVED',
    };

    if (!isOnline) {
      this.enqueueOfflineOperation({
        type: 'createHelpRequest',
        localRequestId: record.id,
        payload: { userId: currentUser, requestPayload },
      });
      return record;
    }

    // Try to persist remotely
    try {
      const remote = await createHelpRequest(currentUser, requestPayload);
      const serverId = remote.id || db.requests[0].id;
      const clientId = record.clientId || record.id;
      const syncMap = this.getSyncIdMap();
      if (clientId && serverId) {
        syncMap[clientId] = serverId;
        this.saveSyncIdMap(syncMap);
      }
      // Cache server id
      db.requests[0].id = serverId;
      db.requests[0].serverId = serverId;
      db.requests[0].clientId = clientId;
      db.requests[0].synced = true;
      this.saveDB(db);
      return {
        ...data,
        id: serverId || record.id,
        clientId,
        serverId,
        userId: currentUser,
        timestamp: remote.timestamp || record.timestamp,
        status: remote.status || 'RECEIVED',
        priority: remote.priority || priority,
        synced: true,
      };
    } catch (e) {
      console.warn('Help request API failed; keeping local only', e);
      this.enqueueOfflineOperation({
        type: 'createHelpRequest',
        localRequestId: record.id,
        payload: { userId: currentUser, requestPayload },
      });
    }

    return record;
  },

  async updateRequestLocation(requestId: string, location: string) {
    const db = this.getDB();
    const reqIdx = db.requests.findIndex(r => r.id === requestId);
    if (reqIdx >= 0) {
      db.requests[reqIdx].location = location;
      this.saveDB(db);
    }
    try {
      if (!navigator.onLine) {
        throw new Error('offline');
      }
      const syncMap = this.getSyncIdMap();
      const serverId = syncMap[requestId] || db.requests[reqIdx]?.serverId || requestId;
      await updateHelpRequestLocation(serverId, location);
    } catch (e) {
      console.warn('Failed to update request location remotely', e);
      this.enqueueOfflineOperation({
        type: 'updateHelpRequestLocation',
        payload: { requestId, location },
      });
    }
  },

  getLastKnownLocation(): { location: string; timestamp: string } | null {
    const db = this.getDB();
    const userId = db.currentUser;

    const requests = userId
      ? db.requests.filter(r => r.userId === userId)
      : db.requests;

    if (!requests.length) return null;

    const sorted = [...requests].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latest = sorted[0];

    if (!latest.location) return null;

    return { location: latest.location, timestamp: latest.timestamp };
  },

  async getActiveRequest(): Promise<HelpRequestRecord | null> {
    const db = this.getDB();
    if (!db.currentUser) return null;

    try {
      const remote = await getActiveHelpRequest(db.currentUser);
      if (remote) {
        const normalized: HelpRequestRecord = {
          ...remote.data,
          id: remote.id || remote._id,
          userId: remote.userId,
          timestamp: remote.timestamp || remote.createdAt,
          status: remote.status || 'RECEIVED',
          priority: remote.priority || 'LOW',
          synced: true,
          location: remote.location || remote.data?.location || ''
        } as any;
        return normalized;
      }
    } catch (e) {
      console.warn('API active request fetch failed, falling back to local', e);
    }

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
    const profile = db.users.find(u => u.id === currentUser);

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
    // Best-effort remote status update
    if (profile?.communityId && profile?.fullName) {
      const status = isSafe ? 'SAFE' : 'DANGER';
      this.saveMemberStatus(profile.communityId, profile.id, profile.fullName, status as any);
    }
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
      setBroadcast(orgId, message).catch((e) => console.warn('Broadcast API failed', e));
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
    if (!navigator.onLine) return 0;

    const db = this.getDB();
    const queue = this.getOfflineQueue();
    if (!queue.length) return 0;

    let processed = 0;
    const remaining: OfflineOperation[] = [];
    const syncMap = this.getSyncIdMap();
    const idMap = new Map<string, string>(Object.entries(syncMap));

    for (const op of queue) {
      try {
        if (op.type === 'createHelpRequest') {
          const { userId, requestPayload } = op.payload || {};
          if (!userId || !requestPayload) {
            throw new Error('Invalid createHelpRequest payload');
          }
          const remote = await createHelpRequest(userId, requestPayload);
          const localId = op.localRequestId;
          if (localId) {
            const newId = remote.id || localId;
            idMap.set(localId, newId);
            syncMap[localId] = newId;
            const idx = db.requests.findIndex(r => r.id === localId);
            if (idx >= 0) {
              db.requests[idx] = {
                ...db.requests[idx],
                id: newId,
                clientId: db.requests[idx].clientId || localId,
                serverId: newId,
                timestamp: remote.timestamp || db.requests[idx].timestamp,
                status: remote.status || db.requests[idx].status,
                priority: remote.priority || db.requests[idx].priority,
                synced: true,
              };
            }
          }
          processed++;
          continue;
        }

        if (op.type === 'updateHelpRequestLocation') {
          let { requestId, location } = op.payload || {};
          if (requestId && idMap.has(requestId)) {
            requestId = idMap.get(requestId);
            op.payload.requestId = requestId;
          }
          if (!requestId || !location) {
            throw new Error('Invalid updateHelpRequestLocation payload');
          }
          await updateHelpRequestLocation(requestId, location);
          processed++;
          continue;
        }

        remaining.push(op);
      } catch (e) {
        console.warn('Offline operation failed, will retry later', op, e);
        remaining.push(op);
      }
    }

    this.saveOfflineQueue(remaining);
    this.saveSyncIdMap(syncMap);
    if (processed > 0) {
      this.saveDB(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
      }
    }

    return processed;
  }
};
