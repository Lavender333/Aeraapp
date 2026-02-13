# IMPLEMENTATION ROADMAP (Detailed)

## TABLE OF CONTENTS
1. Database Schema Changes
2. Backend API Route Map
3. Frontend Component Blueprint
4. Type Definitions
5. Service Layer Functions
6. UI Flow Mockups

---

## 1. DATABASE SCHEMA CHANGES

### A. New Tables to Create

#### `households`
```sql
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Your Home',
  household_code VARCHAR(6) UNIQUE NOT NULL, -- e.g., "A3K7Q2"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_households_owner_id ON households(owner_id);
CREATE INDEX idx_households_code ON households(household_code);
```

#### `household_members` (REFACTORED)
```sql
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  age_group VARCHAR(20) NOT NULL, -- 'Adult' | 'Teen' | 'Child' | 'Senior' | 'Infant'
  mobility_flag BOOLEAN DEFAULT FALSE,
  medical_flag BOOLEAN DEFAULT FALSE,
  requires_login BOOLEAN DEFAULT FALSE,
  login_allowed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_household_members_household_id ON household_members(household_id);
```

#### `household_invitations`
```sql
CREATE TABLE household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invitation_code VARCHAR(6) UNIQUE NOT NULL, -- Same format as household_code
  invited_email VARCHAR(255),
  invited_phone VARCHAR(20),
  inviter_id UUID NOT NULL REFERENCES auth.users(id),
  accepted_by_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_household_invitations_code ON household_invitations(invitation_code);
CREATE INDEX idx_household_invitations_household_id ON household_invitations(household_id);
```

#### `household_readiness_scores`
```sql
CREATE TABLE household_readiness_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL UNIQUE REFERENCES households(id) ON DELETE CASCADE,
  overall_readiness_pct NUMERIC(5,2) DEFAULT 0, -- 0-100
  water_days NUMERIC(5,2) DEFAULT 0,
  food_days NUMERIC(5,2) DEFAULT 0,
  power_backup BOOLEAN DEFAULT FALSE,
  medical_supplies BOOLEAN DEFAULT FALSE,
  mobility_risk VARCHAR(20), -- 'LOW' | 'MEDIUM' | 'HIGH'
  last_assessed TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_readiness_household_id ON household_readiness_scores(household_id);
```

#### `readiness_items`
```sql
CREATE TABLE readiness_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'WATER' | 'FOOD' | 'MEDICAL' | 'POWER' | 'MOBILITY' | 'COMMUNICATION'
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity_needed NUMERIC(10,2),
  quantity_have NUMERIC(10,2) DEFAULT 0,
  unit VARCHAR(50), -- 'gallons', 'days', 'count', 'doses'
  status VARCHAR(20) DEFAULT 'NEEDED', -- 'NEEDED' | 'PARTIAL' | 'STOCKED'
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_readiness_items_household_id ON readiness_items(household_id);
CREATE INDEX idx_readiness_items_category ON readiness_items(category);
```

### B. Changes to Existing Tables

#### `profiles` (SIMPLIFIED)
```sql
-- Remove these columns (move to preparedness system):
-- - household_members (count)
-- - household (JSON array)
-- - petDetails
-- - medicalNeeds
-- - mobilityLimitation
-- - medicationDependency
-- - etc.

-- Keep ONLY:
-- - id, email, phone, address, full_name, language, active, created_at, updated_at

ALTER TABLE profiles
  DROP COLUMN household_members,
  DROP COLUMN household,
  DROP COLUMN petDetails,
  DROP COLUMN medicalNeeds,
  DROP COLUMN mobilityLimitation,
  DROP COLUMN medicationDependency,
  DROP COLUMN transportationAccess,
  DROP COLUMN financialStrain,
  DROP COLUMN consentPreparednessPlanning,
  DROP COLUMN consentTimestamp,
  DROP COLUMN zipCode,
  DROP COLUMN insulinDependency,
  DROP COLUMN oxygenPoweredDevice;
```

#### Rename `members` → `org_members` (for clarity)
```sql
ALTER TABLE members RENAME TO org_members;
```

### C. Archive (Don't Delete Yet)

```sql
-- These will be migrated to readiness system:
-- - vitals (household health info)
-- - vulnerability_profiles (demographics)
-- - kit_recommendations (preparedness suggestions)

-- Keep for 90 days, then delete after migration verified
ALTER TABLE vitals RENAME TO vitals_archive;
ALTER TABLE vulnerability_profiles RENAME TO vulnerability_profiles_archive;
ALTER TABLE kit_recommendations RENAME TO kit_recommendations_archive;
```

---

## 2. BACKEND API ROUTE MAP

### New Endpoints

#### IDENTITY (Minimal)
```
GET    /api/profile              → Get current user info
PATCH  /api/profile              → Update name, phone, address
```

#### HOUSEHOLD
```
GET    /api/households/:id              → Get household + members
PATCH  /api/households/:id              → Update household name
GET    /api/households/:id/code         → Get household code (for sharing)

POST   /api/households/:id/members      → Add member
PATCH  /api/households/:id/members/:id  → Edit member
DELETE /api/households/:id/members/:id  → Remove member
GET    /api/households/:id/members      → List members
```

#### HOUSEHOLD INVITATIONS
```
POST   /api/households/:id/invite                → Create invitation
GET    /api/invitations/:code/status             → Check if code valid
POST   /api/invitations/:code/accept             → User accepts invite
DELETE /api/invitations/:id                      → Revoke invitation
GET    /api/invitations/pending                  → List pending invitations (for spouse)
```

#### READINESS (Preparedness)
```
POST   /api/readiness/:householdId/init                 → Initialize from template
GET    /api/readiness/:householdId/items                → List items + status
PATCH  /api/readiness/:householdId/items/:itemId       → Update item quantity/status
POST   /api/readiness/:householdId/items/:itemId/check → Toggle checked
GET    /api/readiness/:householdId/score               → Get overall readiness %
GET    /api/readiness/:householdId/gaps                → Show what's missing
POST   /api/readiness/:householdId/recalculate         → Force recalc
```

#### ORGANIZATION (Refactored, Optional)
```
GET    /api/organizations/:code           → Get org info
POST   /api/profile/organizations/join    → User joins org
DELETE /api/profile/organizations/:code   → User leaves org
GET    /api/organizations/:code/stats     → Aggregated stats (not personal)
```

### Code Examples

#### POST /api/households/:id/members - Add Household Member
```javascript
// backend/routes/households.js
protectedRouter.post(
  '/households/:id/members',
  validate(householdIdParamSchema, 'params'),
  validate(addHouseholdMemberSchema, 'body'),
  requireHouseholdAccess(),
  async (req, res) => {
    const { id: householdId } = req.params;
    const { name, ageGroup, mobilityFlag, medicalFlag, requiresLogin } = req.body;

    const { data: member, error } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        name,
        age_group: ageGroup,
        mobility_flag: mobilityFlag || false,
        medical_flag: medicalFlag || false,
        requires_login: requiresLogin || false,
      })
      .select()
      .single();

    if (error) return respondError(res, 400, error.message);

    // Recalculate readiness immediately
    await recalculateHouseholdReadiness(householdId);

    res.json({ ok: true, member });
  }
);
```

#### POST /api/invitations/:code/accept - Join Household
```javascript
protectedRouter.post(
  '/invitations/:code/accept',
  validate(invitationCodeParamSchema, 'params'),
  async (req, res) => {
    const { code } = req.params;
    const userId = req.user.id;

    // 1. Find invitation
    const { data: invitation, error: findError } = await supabase
      .from('household_invitations')
      .select('*')
      .eq('invitation_code', code)
      .gt('expires_at', 'NOW()')
      .single();

    if (findError || !invitation) {
      return respondError(res, 404, 'Invalid or expired code');
    }

    if (invitation.accepted_at) {
      return respondError(res, 400, 'This invitation already accepted');
    }

    // 2. Accept invitation
    const { error: acceptError } = await supabase
      .from('household_invitations')
      .update({ accepted_by_id: userId, accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (acceptError) return respondError(res, 400, acceptError.message);

    // 3. Add user as household member
    const { data: member, error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: invitation.household_id,
        name: req.user.email, // Will update in settings
        age_group: 'Adult', // Default
      })
      .select()
      .single();

    if (memberError) return respondError(res, 400, memberError.message);

    // 4. Recalculate readiness
    await recalculateHouseholdReadiness(invitation.household_id);

    res.json({ ok: true, message: 'You have joined the household!' });
  }
);
```

#### PATCH /api/readiness/:householdId/items/:itemId - Check Item
```javascript
protectedRouter.patch(
  '/readiness/:householdId/items/:itemId',
  requireHouseholdAccess(),
  validate(updateReadinessItemSchema, 'body'),
  async (req, res) => {
    const { householdId, itemId } = req.params;
    const { quantityHave, status } = req.body;

    const { data: item, error } = await supabase
      .from('readiness_items')
      .update({
        quantity_have: quantityHave,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('household_id', householdId)
      .select()
      .single();

    if (error) return respondError(res, 400, error.message);

    // Recalculate readiness
    await recalculateHouseholdReadiness(householdId);

    res.json({ ok: true, item });
  }
);
```

#### GET /api/readiness/:householdId/score - Get Readiness Score
```javascript
protectedRouter.get(
  '/readiness/:householdId/score',
  requireHouseholdAccess(),
  async (req, res) => {
    const { householdId } = req.params;

    const { data: score, error } = await supabase
      .from('household_readiness_scores')
      .select('*')
      .eq('household_id', householdId)
      .single();

    if (error) return respondError(res, 404, 'No readiness data');

    // Get members to determine needs
    const { data: members } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId);

    const householdSize = members?.length || 1;

    res.json({
      ok: true,
      score: {
        ...score,
        householdSize,
        waterNeededDays: householdSize >= 4 ? 14 : 7,
        foodNeededDays: householdSize >= 4 ? 14 : 7,
      },
    });
  }
);
```

---

## 3. FRONTEND COMPONENT BLUEPRINT

### New Components to Build

#### `HouseholdInvite.tsx`
```tsx
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface HouseholdInviteProps {
  householdCode: string;
  householdName: string;
}

export const HouseholdInvite: React.FC<HouseholdInviteProps> = ({
  householdCode,
  householdName,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(householdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-2">
        Invite to "{householdName}"
      </h3>
      <p className="text-sm text-slate-600 mb-4">
        Share this code with your spouse, partner, or household member to let them join your home.
      </p>

      <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between border border-slate-200">
        <div>
          <p className="text-xs text-slate-500 mb-1">Household Code</p>
          <p className="font-mono text-2xl font-bold text-slate-900">
            {householdCode}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="p-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
        >
          {copied ? (
            <Check size={20} />
          ) : (
            <Copy size={20} />
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Code expires in 30 days. Anyone with this code can join your home.
      </p>
    </div>
  );
};
```

#### `HouseholdJoinFlow.tsx`
```tsx
import React, { useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Loader2 } from 'lucide-react';

interface HouseholdJoinFlowProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const HouseholdJoinFlow: React.FC<HouseholdJoinFlowProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/invitations/${code.toUpperCase()}/accept`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Invalid code or code expired');
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Failed to join household');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Household Code
        </label>
        <Input
          placeholder="e.g., A3K7Q2"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          maxLength={6}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          fullWidth
          disabled={!code || loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          Join Household
        </Button>
      </div>
    </form>
  );
};
```

#### `ReadinessChecklist.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { Check, Minus, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ReadinessItem {
  id: string;
  category: string;
  itemName: string;
  description: string;
  quantityNeeded: number;
  quantityHave: number;
  unit: string;
  status: 'NEEDED' | 'PARTIAL' | 'STOCKED';
}

interface ReadinessChecklistProps {
  householdId: string;
}

export const ReadinessChecklist: React.FC<ReadinessChecklistProps> = ({
  householdId,
}) => {
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const res = await fetch(`/api/readiness/${householdId}/items`);
        const data = await res.json();
        setItems(data.items || []);

        const scoreRes = await fetch(`/api/readiness/${householdId}/score`);
        const scoreData = await scoreRes.json();
        setScore(scoreData.score?.overall_readiness_pct || 0);
      } catch (err) {
        console.error('Failed to load readiness items', err);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [householdId]);

  const categories = ['WATER', 'FOOD', 'MEDICAL', 'POWER', 'MOBILITY'];

  const handleItemUpdate = async (itemId: string, status: string) => {
    try {
      await fetch(`/api/readiness/${householdId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      // Refresh items and score
      const res = await fetch(`/api/readiness/${householdId}/items`);
      const data = await res.json();
      setItems(data.items || []);

      const scoreRes = await fetch(`/api/readiness/${householdId}/score`);
      const scoreData = await scoreRes.json();
      setScore(scoreData.score?.overall_readiness_pct || 0);
    } catch (err) {
      console.error('Failed to update item', err);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600 font-medium">Home Readiness Score</p>
            <p className="text-4xl font-bold text-slate-900 mt-1">{score}%</p>
          </div>
          <div className="w-24 h-24 rounded-full bg-white border-4 border-green-500 flex items-center justify-center">
            <span className="text-2xl font-bold text-green-600">{score}%</span>
          </div>
        </div>
      </div>

      {/* Checklist by Category */}
      <div className="space-y-4">
        {categories.map((category) => {
          const categoryItems = items.filter((i) => i.category === category);
          const checkedCount = categoryItems.filter(
            (i) => i.status === 'STOCKED'
          ).length;
          const total = categoryItems.length;

          return (
            <div key={category} className="bg-white border border-slate-200 rounded-xl p-4 overflow-hidden">
              <div className="mb-3">
                <h3 className="font-bold text-slate-900 flex items-center justify-between">
                  {category}
                  <span className="text-xs font-normal text-slate-500">
                    {checkedCount}/{total}
                  </span>
                </h3>
              </div>

              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                  >
                    <button
                      onClick={() =>
                        handleItemUpdate(
                          item.id,
                          item.status === 'STOCKED' ? 'NEEDED' : 'STOCKED'
                        )
                      }
                      className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        item.status === 'STOCKED'
                          ? 'bg-green-500 border-green-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {item.status === 'STOCKED' && (
                        <Check size={14} className="text-white" />
                      )}
                    </button>

                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          item.status === 'STOCKED'
                            ? 'text-slate-500 line-through'
                            : 'text-slate-900'
                        }`}
                      >
                        {item.itemName}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## 4. TYPE DEFINITIONS

```typescript
// types.ts - New interfaces

export interface Household {
  id: string;
  owner_id: string;
  name: string;
  household_code: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  name: string;
  age_group: 'Adult' | 'Teen' | 'Child' | 'Senior' | 'Infant';
  mobility_flag: boolean;
  medical_flag: boolean;
  requires_login: boolean;
  login_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface HouseholdInvitation {
  id: string;
  household_id: string;
  invitation_code: string;
  invited_email?: string;
  invited_phone?: string;
  inviter_id: string;
  accepted_by_id?: string;
  created_at: string;
  accepted_at?: string;
  expires_at: string;
}

export interface ReadinessItem {
  id: string;
  household_id: string;
  category: 'WATER' | 'FOOD' | 'MEDICAL' | 'POWER' | 'MOBILITY' | 'COMMUNICATION';
  item_name: string;
  description?: string;
  quantity_needed: number;
  quantity_have: number;
  unit: string;
  status: 'NEEDED' | 'PARTIAL' | 'STOCKED';
  checked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdReadinessScore {
  id: string;
  household_id: string;
  overall_readiness_pct: number; // 0-100
  water_days: number;
  food_days: number;
  power_backup: boolean;
  medical_supplies: boolean;
  mobility_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  last_assessed?: string;
  updated_at: string;
}

export interface UserProfile {
  id: string; // auth.users.id
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  language_preference?: LanguageCode;
  active: boolean;
  created_at: string;
  updated_at: string;
  
  // Computed (not stored)
  household?: Household;
  householdMembers?: HouseholdMember[];
  readinessScore?: HouseholdReadinessScore;
}
```

---

## 5. SERVICE LAYER FUNCTIONS

```typescript
// services/householdService.ts

import { supabase } from './supabase';

export async function createHousehold(
  userId: string,
  householdName: string = 'Your Home'
): Promise<Household> {
  const code = generateHouseholdCode();

  const { data, error } = await supabase
    .from('households')
    .insert({
      owner_id: userId,
      name: householdName,
      household_code: code,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getHousehold(householdId: string): Promise<Household> {
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('id', householdId)
    .single();

  if (error) throw error;
  return data;
}

export async function getHouseholdMembers(
  householdId: string
): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addHouseholdMember(
  householdId: string,
  member: Omit<HouseholdMember, 'id' | 'household_id' | 'created_at' | 'updated_at'>
): Promise<HouseholdMember> {
  const { data, error } = await supabase
    .from('household_members')
    .insert({ ...member, household_id: householdId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHouseholdMember(
  memberId: string,
  updates: Partial<HouseholdMember>
): Promise<HouseholdMember> {
  const { data, error } = await supabase
    .from('household_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeHouseholdMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
}

function generateHouseholdCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// services/readinessService.ts

export async function initializeReadinesFromTemplate(
  householdId: string
): Promise<ReadinessItem[]> {
  const template = getReadinessTemplate();

  const { data, error } = await supabase
    .from('readiness_items')
    .insert(
      template.map((item) => ({
        ...item,
        household_id: householdId,
      }))
    )
    .select();

  if (error) throw error;
  return data || [];
}

export async function getReadinessItems(
  householdId: string
): Promise<ReadinessItem[]> {
  const { data, error } = await supabase
    .from('readiness_items')
    .select('*')
    .eq('household_id', householdId)
    .order('category');

  if (error) throw error;
  return data || [];
}

export async function updateReadinessItem(
  itemId: string,
  updates: Partial<ReadinessItem>
): Promise<ReadinessItem> {
  const { data, error } = await supabase
    .from('readiness_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function calculateReadinessScore(
  householdId: string
): Promise<HouseholdReadinessScore> {
  const items = await getReadinessItems(householdId);
  const members = await getHouseholdMembers(householdId);

  const stockedCount = items.filter((i) => i.status === 'STOCKED').length;
  const overallPct = items.length > 0 ? (stockedCount / items.length) * 100 : 0;

  const waterItems = items.filter((i) => i.category === 'WATER');
  const medicalItems = items.filter((i) => i.category === 'MEDICAL');

  const mobilityRisk =
    members.some((m) => m.mobility_flag) ? 'HIGH' : 'LOW';

  const { data, error } = await supabase
    .from('household_readiness_scores')
    .upsert({
      household_id: householdId,
      overall_readiness_pct: Math.round(overallPct),
      water_days: waterItems.reduce((sum, i) => sum + i.quantity_have, 0),
      food_days: items
        .filter((i) => i.category === 'FOOD')
        .reduce((sum, i) => sum + i.quantity_have, 0),
      power_backup:
        items.find((i) => i.category === 'POWER' && i.status === 'STOCKED') !==
        undefined,
      medical_supplies:
        medicalItems.filter((i) => i.status === 'STOCKED').length > 0,
      mobility_risk: mobilityRisk,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function getReadinessTemplate(): Partial<ReadinessItem>[] {
  return [
    // WATER
    { category: 'WATER', item_name: '3-day water supply', description: '1 gallon per person per day', quantity_needed: 3, unit: 'gallons' },
    
    // FOOD
    { category: 'FOOD', item_name: 'Non-perishable food', description: '3-day emergency supply', quantity_needed: 3, unit: 'days' },
    
    // MEDICAL
    { category: 'MEDICAL', item_name: 'First aid kit', quantity_needed: 1, unit: 'count' },
    { category: 'MEDICAL', item_name: 'Prescription medications', description: '30-day supply at minimum', quantity_needed: 1, unit: 'count' },
    
    //POWER
    { category: 'POWER', item_name: 'Flashlights/batteries', quantity_needed: 1, unit: 'count' },
    { category: 'POWER', item_name: 'Backup power source (generator/powerbank)', quantity_needed: 1, unit: 'count' },
    
    // MOBILITY
    { category: 'MOBILITY', item_name: 'Accessible evacuation plan', description: 'Plan for members with mobility issues', quantity_needed: 1, unit: 'count' },
  ];
}
```

---

## 6. UI FLOW MOCKUPS

### Signup Flow (New)
```
SPLASH → LOGIN / REGISTRATION
  ↓
REGISTER STEP 1: Identity
  Input: email, password, name, phone, address
  → Auto-create household in background
  → Show household code
  
REGISTER STEP 2: Add Household Members (Optional)
  Option A: "Add people now" → use HouseholdManager
  Option B: "Do this later" → skip
  
REGISTER COMPLETE
  → Show new user "Welcome" screen
  → Display household code (prominent)
  → "Start Safety Setup" CTA
  
DASHBOARD
  ├─ Your Home (card)
  │  └─ Show members
  │  └─ Show invitation code
  │
  ├─ Safety Setup (card) - if not started
  │  └─ "Start Now" button
  │  └─ Shows 0%
  │
  └─ [Help button if needed]
```

### Household Code Flow
```
In Settings → Household
  
  [Card: "Your Home"]
  Name: "Your Home"
  Members: 1 Adult + 2 Children
  Code: A3K7Q2 [Copy button]
  
  [Button: "Invite Member"]
    → Show modal with code
    → "Share this code with family"
    → Copy/Share buttons

Accepting (Different Device):
  → Second user: Settings → "Join Household"
  → Input field: "A3K7Q2"
  → Success: "Joined! Your household now appears"
  → Shared members list + readiness
```

### Readiness Checklist Flow
```
Dashboard → "Start Safety Setup"
  ↓
Onboarding modal:
  "Let's make sure your home is prepared"
  [Start button]
  ↓
Full-page view: ReadinessChecklist
  ├─ Score card (0% initially)
  ├─ WATER section
  │  ├─ [ ] 3-day water supply
  │  ├─ [ ] Backup containers
  │  └─ + Add custom item
  ├─ FOOD section
  │  ├─ [ ] Non-perishable food
  │  └─ + Add custom item
  ├─ MEDICAL section
  │  ├─ [ ] First aid kit
  │  ├─ [ ] Medications
  │  └─ + Add custom item
  ├─ POWER section
  ├─ MOBILITY section
  │  ├─ Optional - only shows if members flagged
  │  └─ [ ] Evacuation plan for mobility
  └─ [Save] [Done]

After checking items:
  → Score updates in real-time
  → "Great progress! 45% ready"
  → Gap analysis: "Still need: water storage, backup power"
```

---

**This concludes the detailed implementation roadmap. Ready to proceed with Phase 1?**
