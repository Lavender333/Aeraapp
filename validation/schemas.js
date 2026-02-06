import { z } from 'zod';

// ===== Auth Schemas =====

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

// ===== Inventory Schemas =====

export const updateInventorySchema = z.object({
  water: z.number().int().min(0).optional().default(0),
  food: z.number().int().min(0).optional().default(0),
  blankets: z.number().int().min(0).optional().default(0),
  medicalKits: z.number().int().min(0).optional().default(0),
});

// ===== Request Schemas =====

export const createRequestSchema = z.object({
  item: z.string().min(1, 'Item is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  provider: z.string().optional(),
  orgName: z.string().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'STOCKED']),
  deliveredQuantity: z.number().int().min(0).optional().default(0),
});

// ===== Member Status Schemas =====

export const updateMemberStatusSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['SAFE', 'DANGER', 'UNKNOWN']),
});

// ===== Broadcast Schema =====

export const updateBroadcastSchema = z.object({
  message: z.string().max(500, 'Message must be 500 characters or less').default(''),
});

// ===== Help Request Schemas =====

export const createHelpRequestSchema = z.object({
  orgId: z.string().optional(),
  data: z.record(z.any()).optional().default({}),
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

// ===== MongoDB ObjectId Validation =====

export const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),
});

export const orgIdSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

export const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
