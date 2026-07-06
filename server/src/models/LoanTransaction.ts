import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const loanTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
    type: { type: String, enum: ['loan_given', 'loan_received', 'repayment_made', 'repayment_received'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    memo: { type: String, trim: true },
  },
  { timestamps: true }
);

export type LoanTransactionDoc = InferSchemaType<typeof loanTransactionSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const LoanTransaction = mongoose.model('LoanTransaction', loanTransactionSchema);
