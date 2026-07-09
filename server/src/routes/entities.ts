import { Router } from "express";
import { z } from "zod";
import { Entity } from "../models/Entity.js";
import { Obligation } from "../models/Obligation.js";
import { requireAuth } from "../middleware/auth.js";
import { stripUserId } from "../middleware/stripUserId.js";
import { getEntityObligationSummariesByCurrency } from "../services/paymentBackService.js";
import { getEntityActivity } from "../services/entityActivityService.js";
import { getLoanBalancesByCurrency } from "../services/loanService.js";
import { User } from "../models/User.js";
import { resolveCurrency, normalizeCurrency } from "../lib/currency.js";

const router = Router();
router.use(requireAuth, stripUserId);

/** GET /entities/obligations?from=&to= – all obligations for the user, optionally date-ranged */
router.get("/obligations", async (req, res) => {
  const filter: Record<string, unknown> = { userId: req.userId };
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {};
    if (req.query.from) range.$gte = new Date(req.query.from as string);
    if (req.query.to)   range.$lte = new Date(req.query.to as string);
    filter.createdAt = range;
  }
  const obligations = await Obligation.find(filter).sort({ createdAt: -1 });
  res.json(obligations);
});

const entitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["person", "charity", "loan", "investment", "other"]).optional(),
  direction: z.enum(["i_owe", "they_owe_me"]),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = { userId: req.userId };
  const direction = req.query.direction as string | undefined;
  if (direction === "i_owe" || direction === "they_owe_me") {
    filter.direction = direction;
  }

  const entities = await Entity.find(filter).sort({ name: 1 });
  const withSummary = await Promise.all(
    entities.map(async (entity) => {
      if (entity.direction === "i_owe") {
        const byCurrency = await getEntityObligationSummariesByCurrency(
          req.userId,
          entity._id.toString(),
          entity.currency ?? "PKR",
        );
        return {
          ...entity.toObject(),
          balancesByCurrency: byCurrency.map((row) => ({
            currency: row.currency,
            balance: row.remaining,
          })),
        };
      }
      const byCurrency = await getLoanBalancesByCurrency(
        req.userId,
        entity._id.toString(),
        entity.currency ?? "PKR",
      );
      return { ...entity.toObject(), balancesByCurrency: byCurrency };
    }),
  );
  res.json(withSummary);
});

router.post("/", async (req, res) => {
  const parsed = entitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await User.findById(req.userId).select(
    "settings.defaultCurrency",
  );
  const currency = resolveCurrency(
    parsed.data.currency,
    undefined,
    user?.settings?.defaultCurrency ?? "PKR",
  );

  const entity = await Entity.create({
    ...parsed.data,
    currency,
    userId: req.userId,
  });
  res.status(201).json(entity);
});

router.get("/:id/activity", async (req, res) => {
  const entity = await Entity.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const activity = await getEntityActivity(req.userId, entity);
  const summary =
    entity.direction === "i_owe"
      ? {
          byCurrency: await getEntityObligationSummariesByCurrency(
            req.userId,
            entity._id.toString(),
            entity.currency ?? "PKR",
          ),
        }
      : {
          byCurrency: await getLoanBalancesByCurrency(
            req.userId,
            entity._id.toString(),
            entity.currency ?? "PKR",
          ),
        };

  res.json({ entity, activity, summary });
});

router.get("/:id/obligations", async (req, res) => {
  const entity = await Entity.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const obligations = await Obligation.find({
    userId: req.userId,
    entityId: entity._id,
  })
    .sort({ createdAt: 1 })
    .populate("sourceTransactionId", "amount date")
    .populate("automationId", "name percentage");

  const withRemaining = obligations.map((o) => ({
    ...o.toObject(),
    remaining: o.totalDue - o.paid,
  }));

  res.json(withRemaining);
});

router.get("/:id/summary", async (req, res) => {
  const entity = await Entity.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const summary = await getEntityObligationSummariesByCurrency(
    req.userId,
    entity._id.toString(),
    entity.currency ?? "PKR",
  );
  res.json({ entity, byCurrency: summary });
});

const manualObligationSchema = z.object({
  totalDue: z.number().positive(),
  currency: z.string().optional(),
});

router.post("/:id/obligations", async (req, res) => {
  const entity = await Entity.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  const parsed = manualObligationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await User.findById(req.userId).select("settings.defaultCurrency");
  const currency = normalizeCurrency(
    parsed.data.currency ?? entity.currency ?? user?.settings?.defaultCurrency,
    entity.currency ?? "PKR",
  );

  const obligation = await Obligation.create({
    userId: req.userId,
    entityId: entity._id,
    totalDue: Math.round(parsed.data.totalDue),
    currency,
    paid: 0,
    status: "pending",
  });

  res.status(201).json(obligation);
});

export default router;
