import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb } from './lib/db.js';
import { Account } from './models/Account.js';
import { Category } from './models/Category.js';
import { Transaction } from './models/Transaction.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import entityRoutes from './routes/entities.js';
import paymentBackRoutes from './routes/payment-backs.js';
import importRoutes from './routes/import.js';
import settingsRoutes from './routes/settings.js';
import automationRoutes from './routes/automations.js';
import loanRoutes from './routes/loans.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/payment-backs', paymentBackRoutes);
app.use('/api/import', importRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/loans', loanRoutes);

async function start() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

  await connectDb(uri);
  await Promise.all([Category.syncIndexes(), Account.syncIndexes(), Transaction.syncIndexes()]);
  app.listen(port, () => console.log(`API http://localhost:${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
