import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true, required: true },
    orgName: { type: String },
    item: { type: String, required: true }, // Water, Food, Blankets, Med Kits
    quantity: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'FULFILLED', 'STOCKED'], default: 'PENDING' },
    provider: { type: String },
    deliveredQuantity: { type: Number, default: 0 },
    signature: { type: String },
    signedAt: { type: String },
    receivedSignature: { type: String },
    receivedAt: { type: String },
    stocked: { type: Boolean, default: false },
    stockedAt: { type: String },
    stockedQuantity: { type: Number, default: 0 },
    orgConfirmed: { type: Boolean, default: false },
    orgConfirmedAt: { type: String },
  },
  { timestamps: true }
);

export const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);
