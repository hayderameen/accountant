import { Router } from 'express';
import { z } from 'zod';
import { Account } from '../models/Account.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';

const router = Router();
router.use(requireAuth, stripUserId);

const accountSchema = z.object({
  name: z.string().min(1),
  balance: z.number().optional(),
  currency: z.string().optional(),
});

router.get('/', async (req, res) => {
  const accounts = await Account.find({ userId: req.userId }).sort({ name: 1 });
  res.json(accounts);
});

router.post('/', async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const account = await Account.create({ ...parsed.data, userId: req.userId });
  res.status(201).json(account);
});

router.patch('/:id', async (req, res) => {
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const account = await Account.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    parsed.data,
    { new: true }
  );
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json(account);
});

router.delete('/:id', async (req, res) => {
  const result = await Account.deleteOne({ _id: req.params.id, userId: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
