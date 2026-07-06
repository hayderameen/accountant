import { Router } from 'express';
import { z } from 'zod';
import { Entity } from '../models/Entity.js';
import { Obligation } from '../models/Obligation.js';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';
import { getEntityObligationSummary } from '../services/paymentBackService.js';

const router = Router();
router.use(requireAuth, stripUserId);

const entitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['person', 'charity', 'loan', 'investment', 'other']).optional(),
  direction: z.enum(['i_owe', 'they_owe_me']),
  notes: z.string().optional(),
});

router.get('/', async (req, res) => {
  const entities = await Entity.find({ userId: req.userId }).sort({ name: 1 });
  const withSummary = await Promise.all(
    entities.map(async (entity) => {
      const summary = await getEntityObligationSummary(req.userId, entity._id.toString());
      return { ...entity.toObject(), obligationSummary: summary };
    })
  );
  res.json(withSummary);
});

router.post('/', async (req, res) => {
  const parsed = entitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const entity = await Entity.create({ ...parsed.data, userId: req.userId });
  res.status(201).json(entity);
});

router.get('/:id/obligations', async (req, res) => {
  const entity = await Entity.findOne({ _id: req.params.id, userId: req.userId });
  if (!entity) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  const obligations = await Obligation.find({ userId: req.userId, entityId: entity._id })
    .sort({ createdAt: 1 })
    .populate('sourceTransactionId', 'amount date')
    .populate('automationId', 'name percentage');

  const withRemaining = obligations.map((o) => ({
    ...o.toObject(),
    remaining: o.totalDue - o.paid,
  }));

  res.json(withRemaining);
});

router.get('/:id/summary', async (req, res) => {
  const entity = await Entity.findOne({ _id: req.params.id, userId: req.userId });
  if (!entity) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  const summary = await getEntityObligationSummary(req.userId, entity._id.toString());
  res.json({ entity, ...summary });
});

const manualObligationSchema = z.object({
  totalDue: z.number().positive(),
});

router.post('/:id/obligations', async (req, res) => {
  const entity = await Entity.findOne({ _id: req.params.id, userId: req.userId });
  if (!entity) {
    res.status(404).json({ error: 'Entity not found' });
    return;
  }

  const parsed = manualObligationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const obligation = await Obligation.create({
    userId: req.userId,
    entityId: entity._id,
    totalDue: Math.round(parsed.data.totalDue),
    paid: 0,
    status: 'pending',
  });

  res.status(201).json(obligation);
});

export default router;
