import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    orgId: { type: String, index: true, unique: true, required: true },
    water: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    blankets: { type: Number, default: 0 },
    medicalKits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
