import mongoose from 'mongoose';

const broadcastSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true, unique: true, required: true },
    message: { type: String, default: '' },
    history: {
      type: [
        {
          message: { type: String },
          createdAt: { type: Date, default: Date.now },
          authorId: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Broadcast = mongoose.models.Broadcast || mongoose.model('Broadcast', broadcastSchema);
