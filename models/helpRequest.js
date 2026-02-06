import mongoose from 'mongoose';

const helpRequestDataSchema = new mongoose.Schema(
  {
    // Step 1: Safety
    isSafe: { type: Boolean },
    location: { type: String },
    emergencyType: { type: String, enum: ['Medical', 'Fire', 'Flood', 'Structure Damage', 'Other'] },
    isInjured: { type: Boolean },
    injuryDetails: { type: String },

    // Step 2: Situation
    situationDescription: { type: String },
    canEvacuate: { type: Boolean },
    hazardsPresent: { type: Boolean },
    hazardDetails: { type: String },
    peopleCount: { type: Number },
    petsPresent: { type: Boolean },

    // Step 3: Resources
    hasWater: { type: Boolean },
    hasFood: { type: Boolean },
    hasMeds: { type: Boolean },
    hasPower: { type: Boolean },
    hasPhone: { type: Boolean },

    // Step 4: Vulnerabilities & Media
    needsTransport: { type: Boolean },
    vulnerableGroups: { type: [String], default: [] },
    medicalConditions: { type: String },
    damageType: { type: String },

    // Step 5: Consent
    consentToShare: { type: Boolean },
  },
  { _id: false }
);

const helpRequestSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true },
    userId: { type: String, index: true, required: true },
    data: { type: helpRequestDataSchema, default: {} },
    status: { type: String, enum: ['PENDING', 'RECEIVED', 'DISPATCHED', 'RESOLVED'], default: 'RECEIVED' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    location: { type: String, default: '' },
  },
  { timestamps: true }
);

helpRequestSchema.index({ status: 1, priority: 1 });
helpRequestSchema.index({ orgId: 1, createdAt: -1 });

export const HelpRequest =
  mongoose.models.HelpRequest || mongoose.model('HelpRequest', helpRequestSchema);
