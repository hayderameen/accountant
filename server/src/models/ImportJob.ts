import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const importJobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['preview', 'completed', 'failed'], default: 'preview' },
    fileName: { type: String },
    filePath: { type: String },
    preview: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  { timestamps: true }
);

export type ImportJobDoc = InferSchemaType<typeof importJobSchema> & { _id: mongoose.Types.ObjectId };
export const ImportJob = mongoose.model('ImportJob', importJobSchema);
