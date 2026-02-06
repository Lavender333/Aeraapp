import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['SAFE', 'DANGER', 'UNKNOWN'], default: 'UNKNOWN' },
    statusUpdatedAt: { type: Date },
    location: { type: String, default: 'Unknown' },
    lastUpdate: { type: String, default: '' },
    lastUpdateAt: { type: Date },
    needs: { type: [String], default: [] },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    emergencyContactName: { type: String, default: '' },
    emergencyContactPhone: { type: String, default: '' },
    emergencyContactRelation: { type: String, default: '' },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export const Member = mongoose.models.Member || mongoose.model('Member', memberSchema);
