import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const automationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    trigger: { type: String, enum: ['on_income'], default: 'on_income' },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    targetEntityId: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type AutomationDoc = InferSchemaType<typeof automationSchema> & { _id: mongoose.Types.ObjectId };
export const Automation = mongoose.model('Automation', automationSchema);
