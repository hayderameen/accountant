import { Router } from "express";
import { z } from "zod";
import { Automation } from "../models/Automation.js";
import { Entity } from "../models/Entity.js";
import { requireAuth } from "../middleware/auth.js";
import { stripUserId } from "../middleware/stripUserId.js";
import { User } from "../models/User.js";
import { resolveCurrency } from "../lib/currency.js";

const router = Router();
router.use(requireAuth, stripUserId);

const automationSchema = z
  .object({
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
    targetEntityId: z.string().optional(),
    newEntityName: z.string().min(1).optional(),
    entityType: z
      .enum(["person", "charity", "loan", "investment", "other"])
      .optional(),
    entityCurrency: z.string().optional(),
  })
  .refine((d) => d.targetEntityId || d.newEntityName, {
    message: "Select an entity or provide a new entity name",
  });

router.get("/", async (req, res) => {
  const automations = await Automation.find({ userId: req.userId })
    .sort({ createdAt: -1 })
    .populate("targetEntityId", "name direction type");

  res.json(automations);
});

router.post("/", async (req, res) => {
  const parsed = automationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  let targetEntityId = data.targetEntityId;

  if (data.newEntityName) {
    const user = await User.findById(req.userId).select(
      "settings.defaultCurrency",
    );
    const currency = resolveCurrency(
      data.entityCurrency,
      undefined,
      user?.settings?.defaultCurrency ?? "PKR",
    );
    const entity = await Entity.create({
      userId: req.userId,
      name: data.newEntityName,
      direction: "i_owe",
      type: data.entityType ?? "other",
      currency,
    });
    targetEntityId = entity._id.toString();
  } else {
    const entity = await Entity.findOne({
      _id: targetEntityId,
      userId: req.userId,
      direction: "i_owe",
    });
    if (!entity) {
      res.status(400).json({ error: "Pending loan entity not found" });
      return;
    }
  }

  const automation = await Automation.create({
    userId: req.userId,
    name: data.name,
    percentage: data.percentage,
    targetEntityId,
    active: true,
  });

  const populated = await automation.populate(
    "targetEntityId",
    "name direction type",
  );
  res.status(201).json(populated);
});

router.patch("/:id", async (req, res) => {
  const updates = z
    .object({
      name: z.string().min(1).optional(),
      percentage: z.number().min(0).max(100).optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);

  if (!updates.success) {
    res.status(400).json({ error: updates.error.flatten() });
    return;
  }

  const automation = await Automation.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    updates.data,
    { new: true },
  ).populate("targetEntityId", "name direction type");

  if (!automation) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  res.json(automation);
});

router.delete("/:id", async (req, res) => {
  const result = await Automation.deleteOne({
    _id: req.params.id,
    userId: req.userId,
  });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
