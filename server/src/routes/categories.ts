import { Router } from 'express';
import { z } from 'zod';
import { Category } from '../models/Category.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';

const router = Router();
router.use(requireAuth, stripUserId);

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  parentId: z.string().optional(),
});

router.get('/', async (req, res) => {
  const type = req.query.type as string | undefined;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (type === 'income' || type === 'expense') filter.type = type;
  const categories = await Category.find(filter).sort({ type: 1, name: 1 });
  res.json(categories);
});

router.post('/', async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const category = await Category.create({ ...parsed.data, userId: req.userId });
  res.status(201).json(category);
});

export default router;
