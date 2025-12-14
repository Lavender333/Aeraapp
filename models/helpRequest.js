import mongoose from 'mongoose';

const helpRequestSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true },
    userId: { type: String, index: true, required: true },
    data: { type: Object, default: {} },
    status: { type: String, enum: ['PENDING', 'RECEIVED', 'DISPATCHED', 'RESOLVED'], default: 'RECEIVED' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    location: { type: String, default: '' },
  },
  { timestamps: true }
);

export const HelpRequest =
  mongoose.models.HelpRequest || mongoose.model('HelpRequest', helpRequestSchema);
