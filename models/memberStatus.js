import mongoose from 'mongoose';

const memberStatusSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true, required: true },
    memberId: { type: String, required: true },
    name: { type: String },
    status: { type: String, enum: ['SAFE', 'DANGER', 'UNKNOWN'], default: 'UNKNOWN' },
  },
  { timestamps: true }
);

memberStatusSchema.index({ orgId: 1, memberId: 1 }, { unique: true });

export const MemberStatus = mongoose.models.MemberStatus || mongoose.model('MemberStatus', memberStatusSchema);
