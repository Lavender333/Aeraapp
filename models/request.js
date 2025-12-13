import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true, required: true },
    orgName: { type: String },
    item: { type: String, required: true }, // Water, Food, Blankets, Med Kits
    quantity: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'FULFILLED', 'STOCKED'], default: 'PENDING' },
    provider: { type: String },
    deliveredQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);
