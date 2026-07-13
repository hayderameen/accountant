import mongoose, { Schema, type InferSchemaType } from "mongoose";

const entitySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, select: false },
    type: {
      type: String,
      enum: ["person", "charity", "loan", "investment", "other"],
      default: "other",
    },
    direction: { type: String, enum: ["i_owe", "they_owe_me"], required: true },
    currency: { type: String, default: "PKR" },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

entitySchema.pre("validate", function () {
  if (this.name) this.nameKey = this.name.trim().toLocaleLowerCase("en-US");
});

entitySchema.index(
  { userId: 1, nameKey: 1 },
  {
    unique: true,
    partialFilterExpression: { nameKey: { $type: "string" } },
  },
);

export type EntityDoc = InferSchemaType<typeof entitySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Entity = mongoose.model("Entity", entitySchema);
