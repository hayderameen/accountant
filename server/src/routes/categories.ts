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

router.patch('/:id', async (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    parsed.data,
    { new: true }
  );
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  res.json(category);
});

router.delete('/:id', async (req, res) => {
  const result = await Category.deleteOne({ _id: req.params.id, userId: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
