import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import categoryRoutes from "./routes/categories.js";
import transactionRoutes from "./routes/transactions.js";
import entityRoutes from "./routes/entities.js";
import paymentBackRoutes from "./routes/payment-backs.js";
import importRoutes from "./routes/import.js";
import settingsRoutes from "./routes/settings.js";
import automationRoutes from "./routes/automations.js";
import loanRoutes from "./routes/loans.js";
import { connectDb } from "./lib/db.js";

export const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/entities", entityRoutes);
app.use("/api/payment-backs", paymentBackRoutes);
app.use("/api/import", importRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/automations", automationRoutes);
app.use("/api/loans", loanRoutes);

// Cached DB connection — reused across warm serverless invocations
let _dbReady = false;
export async function ensureDb(): Promise<void> {
  if (_dbReady) return;
  const uri = process.env.MONGODB_URI;
  console.log("MONGODB_URI", uri);
  if (!uri) throw new Error("MONGODB_URI is required");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  await connectDb(uri);
  _dbReady = true;
}
