import { z } from 'zod';

// ===== Auth Schemas =====

const passwordComplexity = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: passwordComplexity,
  fullName: z.string().optional().default(''),
  role: z.enum(['ADMIN', 'CONTRACTOR', 'LOCAL_AUTHORITY', 'FIRST_RESPONDER', 'GENERAL_USER', 'INSTITUTION_ADMIN']).optional().default('GENERAL_USER'),
  orgId: z.string().optional(),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordComplexity,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

// ===== Inventory Schemas =====

const INVENTORY_MAX = 1000000;

export const updateInventorySchema = z.object({
  water: z.number().int().min(0).max(INVENTORY_MAX).optional().default(0),
  food: z.number().int().min(0).max(INVENTORY_MAX).optional().default(0),
  blankets: z.number().int().min(0).max(INVENTORY_MAX).optional().default(0),
  medicalKits: z.number().int().min(0).max(INVENTORY_MAX).optional().default(0),
});

export const adjustInventorySchema = z.object({
  water: z.number().int().min(-INVENTORY_MAX).max(INVENTORY_MAX).optional(),
  food: z.number().int().min(-INVENTORY_MAX).max(INVENTORY_MAX).optional(),
  blankets: z.number().int().min(-INVENTORY_MAX).max(INVENTORY_MAX).optional(),
  medicalKits: z.number().int().min(-INVENTORY_MAX).max(INVENTORY_MAX).optional(),
});

// ===== Request Schemas =====

export const createRequestSchema = z.object({
  item: z.string().min(1, 'Item is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  provider: z.string().optional(),
  orgName: z.string().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'FULFILLED', 'STOCKED']),
  deliveredQuantity: z.number().int().min(0).max(INVENTORY_MAX).optional(),
  signature: z.string().optional(),
  signedAt: z.string().optional(),
  receivedSignature: z.string().optional(),
  receivedAt: z.string().optional(),
  stocked: z.boolean().optional(),
  stockedAt: z.string().optional(),
  stockedQuantity: z.number().int().min(0).max(INVENTORY_MAX).optional(),
  orgConfirmed: z.boolean().optional(),
  orgConfirmedAt: z.string().optional(),
});

// ===== Member Status Schemas =====

export const updateMemberStatusSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  name: z.string().min(1, 'Name is required').optional(),
  status: z.enum(['SAFE', 'DANGER', 'UNKNOWN']),
});

// ===== Broadcast Schema =====

export const updateBroadcastSchema = z.object({
  message: z.string().max(500, 'Message must be 500 characters or less').default(''),
});

// ===== Help Request Schemas =====

const helpRequestDataSchema = z.object({
  // Step 1: Safety
  isSafe: z.boolean().nullable().optional(),
  location: z.string().optional(),
  emergencyType: z.enum(['Medical', 'Fire', 'Flood', 'Structure Damage', 'Other']).optional(),
  isInjured: z.boolean().nullable().optional(),
  injuryDetails: z.string().optional(),

  // Step 2: Situation
  situationDescription: z.string().optional(),
  canEvacuate: z.boolean().nullable().optional(),
  hazardsPresent: z.boolean().nullable().optional(),
  hazardDetails: z.string().optional(),
  peopleCount: z.number().int().min(0).optional(),
  petsPresent: z.boolean().nullable().optional(),

  // Step 3: Resources
  hasWater: z.boolean().nullable().optional(),
  hasFood: z.boolean().nullable().optional(),
  hasMeds: z.boolean().nullable().optional(),
  hasPower: z.boolean().nullable().optional(),
  hasPhone: z.boolean().nullable().optional(),

  // Step 4: Vulnerabilities
  needsTransport: z.boolean().nullable().optional(),
  vulnerableGroups: z.array(z.string()).optional(),
  medicalConditions: z.string().optional(),
  damageType: z.string().optional(),

  // Step 5: Consent
  consentToShare: z.boolean().optional(),
});

export const createHelpRequestSchema = z.object({
  orgId: z.string().optional(),
  data: helpRequestDataSchema.optional().default({}),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('LOW'),
  location: z.string().optional().default(''),
  status: z.enum(['PENDING', 'RECEIVED', 'DISPATCHED', 'RESOLVED']).optional().default('RECEIVED'),
});

export const updateHelpLocationSchema = z.object({
  location: z.string().min(1, 'Location is required'),
});

// ===== Member CRUD Schemas =====

export const createMemberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['SAFE', 'DANGER', 'UNKNOWN']).optional().default('UNKNOWN'),
  location: z.string().optional().default(''),
  lastUpdate: z.string().optional(),
  needs: z.array(z.string()).optional().default([]),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  emergencyContactName: z.string().optional().default(''),
  emergencyContactPhone: z.string().optional().default(''),
  emergencyContactRelation: z.string().optional().default(''),
});

export const updateMemberSchema = createMemberSchema.partial();

// ===== Organization Schemas =====

export const createOrganizationSchema = z.object({
  code: z.string().min(3).max(20).optional(),
  id: z.string().min(3).max(20).optional(),
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['CHURCH', 'NGO', 'COMMUNITY_CENTER', 'LOCAL_GOV']),
  address: z.string().max(500).optional(),
  adminContact: z.string().max(100).optional(),
  adminPhone: z.string().optional(),
  adminEmail: z.string().email().optional(),
  replenishmentProvider: z.string().optional(),
  replenishmentEmail: z.string().email().optional(),
  replenishmentPhone: z.string().optional(),
  verified: z.boolean().optional(),
  active: z.boolean().optional(),
  settings: z
    .object({
      allowPublicMembership: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
    })
    .optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// ===== MongoDB ObjectId Validation =====

export const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),
});

export const orgIdSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

export const orgIdParamSchema = orgIdSchema;

export const requestIdParamSchema = z.object({
  id: z.string().min(1, 'Request ID is required'),
});

export const memberIdParamSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  id: z.string().min(1, 'Member ID is required'),
});

export const orgMemberStatusParamSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

export const helpIdParamSchema = z.object({
  id: z.string().min(1, 'Help request ID is required'),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const organizationIdParamSchema = z.object({
  id: z.string().min(1, 'Organization ID is required'),
});

export const paginationQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
