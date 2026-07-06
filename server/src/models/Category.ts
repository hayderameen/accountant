import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
    externalUid: { type: String },
    source: { type: String, enum: ['app', 'money_manager'], default: 'app' },
  },
  { timestamps: true }
);

categorySchema.index(
  { userId: 1, externalUid: 1 },
  {
    unique: true,
    partialFilterExpression: { externalUid: { $type: 'string' } },
  }
);

export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: mongoose.Types.ObjectId };
export const Category = mongoose.model('Category', categorySchema);
