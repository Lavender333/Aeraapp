# AERA Frontend Integration with Supabase
# Migration Guide from Express API to Supabase

## 📋 Overview

This guide shows how to migrate AERA's frontend from Express.js API calls to Supabase client SDK, enabling:
- ✅ **Authentication** with Supabase Auth
- ✅ **Real-time subscriptions** for live updates
- ✅ **Row Level Security** enforced automatically
- ✅ **Offline support** with automatic retry
- ✅ **TypeScript type safety** with generated types

---

## 🚀 Setup

### 1. Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 2. Create Supabase Client

```typescript
// services/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types'; // Generated from Supabase CLI

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

// Helper function to get current user's org_id
export async function getCurrentOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  
  return profile?.org_id || null;
}
```

### 3. Environment Variables

```bash
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Generate TypeScript Types

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Generate types from your Supabase project
supabase gen types typescript --project-id your-project-id > services/database.types.ts
```

---

## 🔐 Authentication Migration

### OLD: Express API

```typescript
// OLD: services/api.ts
export async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const { token, user } = await response.json();
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  
  return user;
}

export async function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
```

### NEW: Supabase Auth

```typescript
// NEW: services/auth.ts
import { supabase } from './supabase';

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  
  // Session automatically stored in localStorage
  return data.user;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signup(email: string, password: string, userData: {
  fullName: string;
  orgId: string;
  role: string;
  phone?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: userData.fullName,
        org_id: userData.orgId,
        role: userData.role,
        phone: userData.phone
      }
    }
  });
  
  if (error) throw error;
  
  return data.user;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  if (error) throw error;
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}
```

### Update LoginView Component

```tsx
// views/LoginView.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/auth';

export function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Protect Routes with Auth

```tsx
// App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route
          path="/dashboard"
          element={user ? <DashboardView /> : <Navigate to="/login" />}
        />
        {/* Add more routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 📊 CRUD Operations Migration

### Help Requests (SOS)

#### OLD: Express API

```typescript
// OLD: Fetch help requests
async function getHelpRequests() {
  const response = await fetch('/api/help-requests', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.json();
}

// OLD: Create help request
async function createHelpRequest(data: any) {
  const response = await fetch('/api/help-requests', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

#### NEW: Supabase

```typescript
// NEW: services/helpRequests.ts
import { supabase, getCurrentOrgId } from './supabase';

export async function getHelpRequests() {
  const { data, error } = await supabase
    .from('help_requests')
    .select(`
      *,
      profiles!help_requests_user_id_fkey (
        full_name,
        phone
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getMyHelpRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('help_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function createHelpRequest(requestData: {
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  status?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error('No organization associated with user');
  
  const { data, error } = await supabase
    .from('help_requests')
    .insert({
      user_id: user.id,
      org_id: orgId,
      lat: requestData.lat,
      lng: requestData.lng,
      address: requestData.address,
      description: requestData.description,
      status: requestData.status || 'PENDING'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateHelpRequestStatus(
  requestId: string,
  status: string
) {
  const { data, error } = await supabase
    .from('help_requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateHelpRequestLocation(
  requestId: string,
  lat: number,
  lng: number,
  address?: string
) {
  const { data, error } = await supabase
    .from('help_requests')
    .update({ lat, lng, address })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteHelpRequest(requestId: string) {
  const { error } = await supabase
    .from('help_requests')
    .delete()
    .eq('id', requestId);
  
  if (error) throw error;
}
```

#### Update HelpFormView Component

```tsx
// views/HelpFormView.tsx
import React, { useState } from 'react';
import { createHelpRequest } from '../services/helpRequests';
import { getCurrentPosition } from '../services/geolocation';

export function HelpFormView() {
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const handleGetLocation = async () => {
    try {
      const position = await getCurrentPosition();
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    } catch (error) {
      alert('Failed to get location. Please enter manually.');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location) {
      alert('Please get your location first');
      return;
    }
    
    setLoading(true);
    
    try {
      await createHelpRequest({
        lat: location.lat,
        lng: location.lng,
        description
      });
      
      alert('Help request submitted successfully!');
      // Navigate to dashboard
    } catch (error: any) {
      alert(`Failed to submit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <button type="button" onClick={handleGetLocation}>
        Get My Location
      </button>
      {location && (
        <p>Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
      )}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your situation (optional)"
      />
      <button type="submit" disabled={loading || !location}>
        {loading ? 'Submitting...' : 'Submit Help Request'}
      </button>
    </form>
  );
}
```

---

### Inventory Management

#### NEW: Supabase Implementation

```typescript
// services/inventory.ts
import { supabase, getCurrentOrgId } from './supabase';

export async function getInventory() {
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error('No organization');
  
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('org_id', orgId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateInventory(updates: {
  food?: number;
  water?: number;
  medical?: number;
  shelter?: number;
  hygiene?: number;
  clothing?: number;
  communication?: number;
  power?: number;
  other?: number;
}) {
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error('No organization');
  
  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('org_id', orgId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

#### Update LogisticsView Component

```tsx
// views/LogisticsView.tsx
import React, { useEffect, useState } from 'react';
import { getInventory, updateInventory } from '../services/inventory';

export function LogisticsView() {
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadInventory();
  }, []);
  
  const loadInventory = async () => {
    try {
      const data = await getInventory();
      setInventory(data);
    } catch (error: any) {
      console.error('Failed to load inventory:', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdate = async (category: string, value: number) => {
    setSaving(true);
    
    try {
      const updated = await updateInventory({ [category]: value });
      setInventory(updated);
    } catch (error: any) {
      alert(`Failed to update: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) return <div>Loading inventory...</div>;
  if (!inventory) return <div>No inventory found</div>;
  
  return (
    <div>
      <h2>Inventory Management</h2>
      <div>
        <label>Food</label>
        <input
          type="number"
          min="0"
          value={inventory.food}
          onChange={(e) => handleUpdate('food', parseInt(e.target.value, 10))}
          disabled={saving}
        />
      </div>
      <div>
        <label>Water</label>
        <input
          type="number"
          min="0"
          value={inventory.water}
          onChange={(e) => handleUpdate('water', parseInt(e.target.value, 10))}
          disabled={saving}
        />
      </div>
      {/* Add more categories */}
    </div>
  );
}
```

---

## 🔴 Real-Time Subscriptions

### Subscribe to Help Requests

```typescript
// services/realtimeSubscriptions.ts
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function subscribeToHelpRequests(
  orgId: string,
  callbacks: {
    onInsert?: (payload: any) => void;
    onUpdate?: (payload: any) => void;
    onDelete?: (payload: any) => void;
  }
): RealtimeChannel {
  const channel = supabase
    .channel(`help_requests_${orgId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'help_requests',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        console.log('New help request:', payload.new);
        callbacks.onInsert?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'help_requests',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        console.log('Help request updated:', payload.new);
        callbacks.onUpdate?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'help_requests',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        console.log('Help request deleted:', payload.old);
        callbacks.onDelete?.(payload.old);
      }
    )
    .subscribe();
  
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
```

### Use Realtime in Component

```tsx
// views/DashboardView.tsx
import React, { useEffect, useState } from 'react';
import { getHelpRequests } from '../services/helpRequests';
import { subscribeToHelpRequests, unsubscribe } from '../services/realtimeSubscriptions';
import { getCurrentOrgId } from '../services/supabase';

export function DashboardView() {
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let channel: any;
    
    async function init() {
      // Load initial data
      const data = await getHelpRequests();
      setHelpRequests(data);
      setLoading(false);
      
      // Subscribe to realtime updates
      const orgId = await getCurrentOrgId();
      if (orgId) {
        channel = subscribeToHelpRequests(orgId, {
          onInsert: (newRequest) => {
            setHelpRequests((prev) => [newRequest, ...prev]);
            // Show notification
            showNotification('New help request received!');
          },
          onUpdate: (updatedRequest) => {
            setHelpRequests((prev) =>
              prev.map((req) =>
                req.id === updatedRequest.id ? updatedRequest : req
              )
            );
          },
          onDelete: (deletedRequest) => {
            setHelpRequests((prev) =>
              prev.filter((req) => req.id !== deletedRequest.id)
            );
          }
        });
      }
    }
    
    init();
    
    // Cleanup on unmount
    return () => {
      if (channel) unsubscribe(channel);
    };
  }, []);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Active Help Requests</h2>
      {helpRequests.map((request) => (
        <div key={request.id}>
          <p>{request.description}</p>
          <p>Status: {request.status}</p>
          <p>Location: {request.lat}, {request.lng}</p>
        </div>
      ))}
    </div>
  );
}

function showNotification(message: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('AERA Alert', { body: message });
  } else {
    alert(message);
  }
}
```

### Subscribe to Multiple Tables

```typescript
// Custom hook for realtime subscriptions
import { useEffect, useState } from 'react';
import { supabase, getCurrentOrgId } from '../services/supabase';

export function useRealtimeTable<T>(
  table: string,
  initialFetch: () => Promise<T[]>
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let channel: any;
    
    async function init() {
      // Fetch initial data
      const initialData = await initialFetch();
      setData(initialData);
      setLoading(false);
      
      // Subscribe to changes
      const orgId = await getCurrentOrgId();
      
      channel = supabase
        .channel(`${table}_${orgId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // All events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table,
            filter: `org_id=eq.${orgId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setData((prev) => [payload.new as T, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setData((prev) =>
                prev.map((item: any) =>
                  item.id === payload.new.id ? (payload.new as T) : item
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setData((prev) =>
                prev.filter((item: any) => item.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe();
    }
    
    init();
    
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [table]);
  
  return { data, loading };
}

// Usage:
function InventoryDashboard() {
  const { data: inventory, loading } = useRealtimeTable(
    'inventory',
    () => supabase.from('inventory').select('*').then(({ data }) => data || [])
  );
  
  if (loading) return <div>Loading...</div>;
  
  return <div>Inventory: {JSON.stringify(inventory)}</div>;
}
```

---

## 🌐 Offline Support

### Offline Queue with Supabase

```typescript
// services/offlineQueue.ts
import { supabase } from './supabase';

interface QueuedOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  
  constructor() {
    this.loadQueue();
    window.addEventListener('online', () => this.sync());
  }
  
  enqueue(op: Omit<QueuedOperation, 'id' | 'timestamp'>) {
    const operation: QueuedOperation = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    this.queue.push(operation);
    this.saveQueue();
  }
  
  async sync() {
    if (this.queue.length === 0) return;
    
    console.log(`Syncing ${this.queue.length} operations...`);
    
    const operations = [...this.queue];
    
    for (const op of operations) {
      try {
        await this.processOperation(op);
        this.queue = this.queue.filter((q) => q.id !== op.id);
      } catch (error) {
        console.error('Sync failed for operation:', op, error);
      }
    }
    
    this.saveQueue();
  }
  
  private async processOperation(op: QueuedOperation) {
    if (op.operation === 'insert') {
      await supabase.from(op.table).insert(op.data);
    } else if (op.operation === 'update') {
      await supabase.from(op.table).update(op.data).eq('id', op.data.id);
    } else if (op.operation === 'delete') {
      await supabase.from(op.table).delete().eq('id', op.data.id);
    }
  }
  
  private saveQueue() {
    localStorage.setItem('offline_queue', JSON.stringify(this.queue));
  }
  
  private loadQueue() {
    const saved = localStorage.getItem('offline_queue');
    if (saved) {
      this.queue = JSON.parse(saved);
    }
  }
}

export const offlineQueue = new OfflineQueue();

// Helper function to queue operation if offline
export async function executeOrQueue<T>(
  operation: () => Promise<T>,
  queueData: Omit<QueuedOperation, 'id' | 'timestamp'>
): Promise<T | void> {
  if (navigator.onLine) {
    return await operation();
  } else {
    offlineQueue.enqueue(queueData);
    console.log('Queued for offline sync:', queueData);
  }
}
```

### Use Offline Queue

```typescript
// Update createHelpRequest to support offline
export async function createHelpRequest(requestData: any) {
  return executeOrQueue(
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const orgId = await getCurrentOrgId();
      
      const { data, error } = await supabase
        .from('help_requests')
        .insert({
          user_id: user!.id,
          org_id: orgId!,
          ...requestData
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      table: 'help_requests',
      operation: 'insert',
      data: requestData
    }
  );
}
```

---

## 📦 Complete Migration Checklist

### Phase 1: Setup (Week 1)
- [ ] Install @supabase/supabase-js
- [ ] Create Supabase client (services/supabase.ts)
- [ ] Generate TypeScript types
- [ ] Set up environment variables

### Phase 2: Authentication (Week 2)
- [ ] Migrate login to Supabase Auth
- [ ] Migrate signup to Supabase Auth
- [ ] Migrate password reset
- [ ] Update LoginView, RegistrationView
- [ ] Implement auth state management
- [ ] Protect routes with auth guards

### Phase 3: CRUD Operations (Weeks 3-4)
- [ ] Migrate help requests API
- [ ] Migrate inventory API
- [ ] Migrate members API
- [ ] Migrate broadcasts API
- [ ] Migrate replenishment requests API
- [ ] Update all view components

### Phase 4: Realtime (Week 5)
- [ ] Set up realtime subscriptions for help_requests
- [ ] Set up realtime for broadcasts
- [ ] Set up realtime for inventory
- [ ] Set up realtime for member_statuses
- [ ] Add notifications for realtime events

### Phase 5: Offline Support (Week 6)
- [ ] Implement offline queue
- [ ] Test offline → online sync
- [ ] Add offline indicator UI

### Phase 6: Testing (Week 7)
- [ ] Test all CRUD operations
- [ ] Test realtime subscriptions
- [ ] Test offline sync
- [ ] Test RLS policies (users can't access other orgs)
- [ ] Load testing

### Phase 7: Deployment (Week 8)
- [ ] Deploy frontend with Supabase integration
- [ ] Monitor for errors
- [ ] Verify realtime working in production

---

**Migration Guide Version**: 1.0  
**Last Updated**: February 5, 2026  
**Estimated Time**: 8 weeks (with testing)
