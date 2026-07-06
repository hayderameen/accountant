import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const allocationSchema = new Schema(
  {
    obligationId: { type: Schema.Types.ObjectId, ref: 'Obligation', required: true },
    amountApplied: { type: Number, required: true },
  },
  { _id: false }
);

const paymentBackSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, ref: 'Entity', required: true, index: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
    totalAmount: { type: Number, required: true },
    date: { type: Date, required: true },
    allocations: { type: [allocationSchema], required: true },
  },
  { timestamps: true }
);

paymentBackSchema.index({ userId: 1, entityId: 1, date: -1 });

export type PaymentBackDoc = InferSchemaType<typeof paymentBackSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const PaymentBack = mongoose.model('PaymentBack', paymentBackSchema);
