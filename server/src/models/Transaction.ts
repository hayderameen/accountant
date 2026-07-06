import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    toAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    entityId: { type: Schema.Types.ObjectId, ref: 'Entity' },
    memo: { type: String, trim: true },
    externalUid: { type: String },
    source: { type: String, enum: ['app', 'money_manager'], default: 'app' },
    importedAt: { type: Date },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, externalUid: 1 }, { unique: true, sparse: true });

export type TransactionDoc = InferSchemaType<typeof transactionSchema> & { _id: mongoose.Types.ObjectId };
export const Transaction = mongoose.model('Transaction', transactionSchema);
