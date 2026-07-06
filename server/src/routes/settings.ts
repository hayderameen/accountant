import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';

const router = Router();
router.use(requireAuth, stripUserId);

const settingsSchema = z.object({
  defaultCurrency: z.string().min(3).max(3).optional(),
  runAutomationsOnImport: z.boolean().optional(),
  name: z.string().min(1).optional(),
});

router.patch('/', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.defaultCurrency) update['settings.defaultCurrency'] = parsed.data.defaultCurrency.toUpperCase();
  if (parsed.data.runAutomationsOnImport !== undefined) {
    update['settings.runAutomationsOnImport'] = parsed.data.runAutomationsOnImport;
  }

  const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true }).select(
    '-passwordHash'
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

export default router;
