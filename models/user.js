import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, index: true, unique: true, sparse: true },
    phone: { type: String, index: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'CONTRACTOR', 'LOCAL_AUTHORITY', 'FIRST_RESPONDER', 'GENERAL_USER', 'INSTITUTION_ADMIN'], default: 'GENERAL_USER' },
    orgId: { type: String, index: true },
    fullName: { type: String, default: '' },
    resetToken: { type: String },
    resetTokenExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// Email or phone is required, enforced at route level.
export const User = mongoose.models.User || mongoose.model('User', userSchema);
