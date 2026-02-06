import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    code: { type: String, index: true, unique: true, sparse: true },
    name: { type: String, required: true, maxlength: 200 },
    type: {
      type: String,
      enum: ['CHURCH', 'NGO', 'COMMUNITY_CENTER', 'LOCAL_GOV'],
      required: true,
    },
    address: { type: String, maxlength: 500 },
    adminContact: { type: String, maxlength: 100 },
    adminPhone: { type: String },
    adminEmail: { type: String },
    replenishmentProvider: { type: String },
    replenishmentEmail: { type: String },
    replenishmentPhone: { type: String },
    registeredPopulation: { type: Number },
    currentBroadcast: { type: String },
    lastBroadcastTime: { type: String },
    verified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    settings: {
      allowPublicMembership: { type: Boolean, default: false },
      requireApproval: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

organizationSchema.index({ name: 'text' });
organizationSchema.index({ code: 1 });
organizationSchema.index({ type: 1 });
organizationSchema.index({ verified: 1, active: 1 });

export const Organization =
  mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
