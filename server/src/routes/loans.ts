import { Router } from 'express';
import { z } from 'zod';
import { Account } from '../models/Account.js';
import { Entity } from '../models/Entity.js';
import { LoanTransaction } from '../models/LoanTransaction.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';
import { getLoanBalancesByCurrency, getLoanBalanceForCurrency, assertRepaymentWithinBalance } from '../services/loanService.js';
import { normalizeCurrency } from '../lib/currency.js';

const router = Router();
router.use(requireAuth, stripUserId);

const loanSchema = z.object({
  entityId: z.string(),
  type: z.enum(['loan_given', 'loan_received', 'repayment_made', 'repayment_received']),
  amount: z.number().positive(),
  currency: z.string().min(1),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  memo: z.string().optional(),
  accountId: z.string().optional(),
});

router.get('/', async (req, res) => {
  const filter: Record<string, unknown> = { userId: req.userId };
  if (req.query.entityId) filter.entityId = req.query.entityId;
  if (req.query.from || req.query.to) {
    const dateFilter: Record<string, Date> = {};
    if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
    if (req.query.to)   dateFilter.$lte = new Date(req.query.to as string);
    filter.date = dateFilter;
  }

  const loans = await LoanTransaction.find(filter)
    .sort({ date: -1 })
    .populate('entityId', 'name direction');

  res.json(loans);
});

router.get('/balances', async (req, res) => {
  const direction = req.query.direction as string | undefined;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (direction === 'i_owe' || direction === 'they_owe_me') {
    filter.direction = direction;
  }

  const entities = await Entity.find(filter).sort({ name: 1 });
  const withBalance = await Promise.all(
    entities.map(async (entity) => ({
      ...entity.toObject(),
      balancesByCurrency: await getLoanBalancesByCurrency(
        req.userId,
        entity._id.toString(),
        entity.currency ?? 'PKR'
      ),
    }))
  );

  res.json(withBalance);
});

router.post('/', async (req, res) => {
  const parsed = loanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const entity = await Entity.findOne({ _id: data.entityId, userId: req.userId });
  if (!entity) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  const user = await User.findById(req.userId).select('settings.defaultCurrency');
  const currency = normalizeCurrency(
    data.currency ?? entity.currency ?? user?.settings?.defaultCurrency,
    entity.currency ?? 'PKR'
  );

  const amountCents = Math.round(data.amount);

  if (data.type === 'repayment_received' || data.type === 'repayment_made') {
    const owed = await getLoanBalanceForCurrency(
      req.userId,
      data.entityId,
      currency,
      entity.currency ?? 'PKR'
    );
    try {
      assertRepaymentWithinBalance(amountCents, owed, currency);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Repayment exceeds amount owed',
      });
      return;
    }
  }

  if (data.accountId) {
    const account = await Account.findOne({ _id: data.accountId, userId: req.userId });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (data.type === 'repayment_received' || data.type === 'loan_received') {
      account.balance += amountCents;
    } else if (data.type === 'loan_given' || data.type === 'repayment_made') {
      account.balance -= amountCents;
    }
    await account.save();
  }

  const loan = await LoanTransaction.create({
    userId: req.userId,
    entityId: data.entityId,
    type: data.type,
    amount: amountCents,
    currency,
    date: data.date ? new Date(data.date) : new Date(),
    memo: data.memo,
  });

  const balancesByCurrency = await getLoanBalancesByCurrency(
    req.userId,
    data.entityId,
    entity.currency ?? 'PKR'
  );
  res.status(201).json({ loan, balancesByCurrency });
});

export default router;
