import mongoose, { Schema, type InferSchemaType } from "mongoose";

const accountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "PKR" },
    externalUid: { type: String },
    source: { type: String, enum: ["app", "money_manager"], default: "app" },
  },
  { timestamps: true },
);

accountSchema.index(
  { userId: 1, externalUid: 1 },
  {
    unique: true,
    partialFilterExpression: { externalUid: { $type: "string" } },
  },
);

export type AccountDoc = InferSchemaType<typeof accountSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Account = mongoose.model("Account", accountSchema);
