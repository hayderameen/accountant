import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { COOKIE_NAME, cookieOptions, signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'income' as const },
  { name: 'Food', type: 'expense' as const },
  { name: 'Transport', type: 'expense' as const },
  { name: 'Rent', type: 'expense' as const },
  { name: 'Utilities', type: 'expense' as const },
  { name: 'Shopping', type: 'expense' as const },
  { name: 'Health', type: 'expense' as const },
  { name: 'Entertainment', type: 'expense' as const },
];

async function seedCategories(userId: string) {
  await Category.insertMany(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, userId }))
  );
}

router.post('/signup', stripUserId, async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password, name } = parsed.data;
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email,
    name: name ?? email.split('@')[0],
    passwordHash,
  });

  await seedCategories(user._id.toString());

  const token = signToken({ sub: user._id.toString(), email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.status(201).json({ id: user._id, email: user.email, name: user.name });
});

router.post('/login', stripUserId, async (req, res) => {
  const parsed = authSchema.omit({ name: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ sub: user._id.toString(), email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ id: user._id, email: user.email, name: user.name });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('-passwordHash');
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

export default router;
