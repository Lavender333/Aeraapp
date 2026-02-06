# Supabase Realtime Configuration

## Overview
This document outlines which tables require realtime subscriptions and why, plus configuration details for the AERA application.

## Realtime-Enabled Tables

### 1. `help_requests` - **CRITICAL**
**Why**: Emergency SOS requests must appear instantly for first responders.

**Use Cases**:
- New help request created → Alert first responders immediately
- Status changed → Update dashboard in real-time
- Location updated → Show on map without refresh

**Frontend Subscription**:
```typescript
const helpRequestsSubscription = supabase
  .channel('help_requests_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'help_requests',
      filter: `org_id=eq.${orgId}` // Filter by organization
    },
    (payload) => {
      console.log('Help request change:', payload);
      // Update local state
      handleHelpRequestChange(payload);
    }
  )
  .subscribe();
```

---

### 2. `broadcasts` - **HIGH PRIORITY**
**Why**: Emergency alerts need instant delivery to all organization members.

**Use Cases**:
- New broadcast posted → Show ticker immediately
- Broadcast updated → Update displayed message

**Frontend Subscription**:
```typescript
const broadcastSubscription = supabase
  .channel('broadcast_changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'broadcasts',
      filter: `org_id=eq.${orgId}`
    },
    (payload) => {
      console.log('Broadcast updated:', payload);
      setBroadcastMessage(payload.new.message);
    }
  )
  .subscribe();
```

---

### 3. `inventory` - **HIGH PRIORITY**
**Why**: Supply levels need real-time updates for coordination.

**Use Cases**:
- Inventory depleted → Alert administrators
- Supplies restocked → Update dashboard
- Multiple users tracking same inventory → Show live changes

**Frontend Subscription**:
```typescript
const inventorySubscription = supabase
  .channel('inventory_changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'inventory',
      filter: `org_id=eq.${orgId}`
    },
    (payload) => {
      console.log('Inventory updated:', payload);
      updateInventoryDisplay(payload.new);
    }
  )
  .subscribe();
```

---

### 4. `member_statuses` - **MEDIUM PRIORITY**
**Why**: Safety status updates should reflect quickly for situational awareness.

**Use Cases**:
- Member checked in as SAFE → Update count immediately
- Member status changed to DANGER → Alert administrators
- Bulk status updates → Show progress in real-time

**Frontend Subscription**:
```typescript
const memberStatusSubscription = supabase
  .channel('member_status_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'member_statuses',
      filter: `org_id=eq.${orgId}`
    },
    (payload) => {
      console.log('Member status change:', payload);
      updateMemberStatusCounts(payload);
    }
  )
  .subscribe();
```

---

### 5. `replenishment_requests` - **MEDIUM PRIORITY**
**Why**: Supply request status changes should be visible to requesters and fulfillment teams.

**Use Cases**:
- New request created → Notify suppliers
- Request fulfilled → Update requester
- Delivery status updated → Show progress

**Frontend Subscription**:
```typescript
const requestsSubscription = supabase
  .channel('requests_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'replenishment_requests',
      filter: `org_id=eq.${orgId}`
    },
    (payload) => {
      console.log('Request change:', payload);
      updateRequestsList(payload);
    }
  )
  .subscribe();
```

---

## Tables NOT Requiring Realtime

### `organizations`
- Changes are infrequent (setup/admin only)
- Not time-critical
- Can refresh on page load

### `profiles`
- User profile changes are not urgent
- Can refresh on login or manual refresh
- Reduces database load

### `members`
- Member directory changes are administrative
- Not emergency-critical
- Can use polling or manual refresh

### `activity_log`
- Audit logs don't need instant visibility
- Too high volume for realtime
- Query on-demand only

---

## Realtime Best Practices

### 1. Filter Aggressively
Always filter subscriptions to minimize data transfer:
```typescript
filter: `org_id=eq.${orgId}` // Only your org's data
```

### 2. Unsubscribe on Cleanup
```typescript
useEffect(() => {
  const subscription = supabase.channel('...').subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}, [orgId]);
```

### 3. Handle Connection States
```typescript
supabase
  .channel('my_channel')
  .on('system', { event: 'CONNECTED' }, () => {
    console.log('Realtime connected');
  })
  .on('system', { event: 'DISCONNECTED' }, () => {
    console.warn('Realtime disconnected');
    // Show reconnection UI
  })
  .subscribe();
```

### 4. Debounce Rapid Updates
```typescript
const debouncedUpdate = debounce((payload) => {
  updateState(payload);
}, 300);

supabase.channel('...').on('postgres_changes', ..., debouncedUpdate);
```

### 5. Presence for Active Users (Optional)
```typescript
const channel = supabase.channel('org_presence', {
  config: {
    presence: {
      key: userId,
    },
  },
});

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Active users:', Object.keys(state));
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }
  });
```

---

## Realtime Authorization

RLS policies automatically apply to realtime subscriptions:

```typescript
// Users can only see help_requests for their org
// This is enforced by RLS, even in realtime subscriptions
supabase
  .channel('help_requests')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'help_requests'
    // No filter needed - RLS handles it!
  })
  .subscribe();
```

**Important**: The filter parameter is for optimization, not security. RLS is the security layer.

---

## Performance Monitoring

### Track Realtime Metrics
```typescript
let messageCount = 0;
let lastMessageTime = Date.now();

supabase.channel('...').on('postgres_changes', ..., (payload) => {
  messageCount++;
  const timeSinceLastMessage = Date.now() - lastMessageTime;
  lastMessageTime = Date.now();
  
  console.log('Realtime metrics:', {
    totalMessages: messageCount,
    timeSinceLastMessage,
    eventType: payload.eventType,
  });
});
```

---

## Fallback Strategy

If realtime is unavailable:

```typescript
const POLL_INTERVAL = 5000; // 5 seconds

useEffect(() => {
  let pollTimer;
  
  const subscription = supabase.channel('...').subscribe((status) => {
    if (status === 'CLOSED') {
      // Realtime failed, fallback to polling
      console.warn('Realtime unavailable, using polling');
      pollTimer = setInterval(fetchData, POLL_INTERVAL);
    }
  });
  
  return () => {
    subscription.unsubscribe();
    if (pollTimer) clearInterval(pollTimer);
  };
}, []);
```

---

## Supabase Configuration

### Enable Realtime in Dashboard
1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for tables:
   - `help_requests`
   - `broadcasts`
   - `inventory`
   - `member_statuses`
   - `replenishment_requests`

### Or via SQL
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE help_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE member_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE replenishment_requests;
```

---

## Testing Realtime

### Test Script
```typescript
// Test realtime subscription
const testRealtime = async () => {
  console.log('Testing realtime...');
  
  const channel = supabase
    .channel('test_help_requests')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'help_requests'
    }, (payload) => {
      console.log('✅ Realtime working!', payload);
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Insert test record
  const { data, error } = await supabase
    .from('help_requests')
    .insert({ 
      user_id: 'test',
      org_id: 'test',
      status: 'PENDING',
      priority: 'LOW'
    });
  
  if (error) console.error('Insert error:', error);
  else console.log('Test record inserted:', data);
};
```

---

## Bandwidth Considerations

### Estimated Bandwidth per Table

| Table | Avg Size | Updates/min (peak) | Bandwidth |
|-------|----------|-------------------|-----------|
| help_requests | 1KB | 10 | 10 KB/min |
| broadcasts | 0.5KB | 2 | 1 KB/min |
| inventory | 0.3KB | 5 | 1.5 KB/min |
| member_statuses | 0.4KB | 20 | 8 KB/min |
| replenishment_requests | 0.7KB | 5 | 3.5 KB/min |
| **Total** | | | **~24 KB/min** |

Per user: **~24 KB/min = 1.4 MB/hour** (very manageable)

---

## Security Considerations

1. **RLS is enforced** - Users only see data they're authorized for
2. **Filter for performance** - Reduce unnecessary data transfer
3. **Validate on server** - Never trust client-side data
4. **Rate limiting** - Supabase has built-in rate limits
5. **Monitor usage** - Track realtime connections in dashboard

---

**Configuration Version**: 1.0  
**Date**: February 5, 2026  
**Phase**: 2 - Supabase Migration
