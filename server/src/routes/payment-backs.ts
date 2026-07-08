import { Router } from 'express';
import { z } from 'zod';
import { Account } from '../models/Account.js';
import { Entity } from '../models/Entity.js';
import { Transaction } from '../models/Transaction.js';
import { PaymentBack } from '../models/PaymentBack.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';
import { recordPaymentBack } from '../services/paymentBackService.js';
import { resolveCurrency } from '../lib/currency.js';

const router = Router();
router.use(requireAuth, stripUserId);

const paymentBackSchema = z.object({
  entityId: z.string(),
  amount: z.number().positive(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  memo: z.string().optional(),
  transactionId: z.string().optional(),
});

router.get('/', async (req, res) => {
  const filter: Record<string, unknown> = { userId: req.userId };
  if (req.query.entityId) filter.entityId = req.query.entityId;

  const paymentBacks = await PaymentBack.find(filter)
    .sort({ date: -1 })
    .populate('entityId', 'name')
    .populate('transactionId', 'amount date memo')
    .populate('allocations.obligationId', 'totalDue paid status');

  res.json(paymentBacks);
});

router.post('/', async (req, res) => {
  const parsed = paymentBackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const amountCents = Math.round(data.amount);
  const date = data.date ? new Date(data.date) : new Date();

  const entity = await Entity.findOne({ _id: data.entityId, userId: req.userId });
  if (!entity) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  let transactionId = data.transactionId;
  let currency = entity.currency ?? 'PKR';

  if (transactionId) {
    const existing = await Transaction.findOne({
      _id: transactionId,
      userId: req.userId,
      type: 'expense',
    });

    if (!existing) {
      res.status(404).json({ error: 'Expense transaction not found' });
      return;
    }

    if (existing.amount !== amountCents) {
      res.status(400).json({ error: 'Amount must match expense transaction amount' });
      return;
    }
    currency = existing.currency ?? currency;
  } else {
    if (!data.accountId) {
      res.status(400).json({ error: 'accountId required when transactionId not provided' });
      return;
    }

    const account = await Account.findOne({ _id: data.accountId, userId: req.userId });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    account.balance -= amountCents;
    await account.save();

    const transaction = await Transaction.create({
      userId: req.userId,
      type: 'expense',
      amount: amountCents,
      date,
      accountId: data.accountId,
      categoryId: data.categoryId,
      entityId: data.entityId,
      currency: resolveCurrency(undefined, account.currency, entity.currency),
      memo: data.memo,
    });
    transactionId = transaction._id.toString();
    currency = transaction.currency ?? currency;
  }

  const result = await recordPaymentBack({
    userId: req.userId,
    entityId: data.entityId,
    transactionId: transactionId!,
    totalAmount: amountCents,
    currency,
    date,
    entityDefaultCurrency: entity.currency ?? 'PKR',
  });

  res.status(201).json(result);
});

export default router;
