import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const obligationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
    sourceTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    automationId: { type: Schema.Types.ObjectId, ref: 'Automation' },
    totalDue: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'fulfilled'], default: 'pending' },
  },
  { timestamps: true }
);

obligationSchema.index({ userId: 1, entityId: 1, status: 1 });

export type ObligationDoc = InferSchemaType<typeof obligationSchema> & { _id: mongoose.Types.ObjectId };
export const Obligation = mongoose.model('Obligation', obligationSchema);
