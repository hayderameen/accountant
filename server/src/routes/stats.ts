import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { stripUserId } from "../middleware/stripUserId.js";
import { getStats } from "../services/statsService.js";

const router = Router();
router.use(requireAuth, stripUserId);

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
  timezone: z.string().min(1).max(100).default("UTC"),
});

router.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (from > to) {
    res.status(400).json({ error: "Start date must be before end date" });
    return;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: parsed.data.timezone,
    }).format(from);
  } catch {
    res.status(400).json({ error: "Invalid timezone" });
    return;
  }

  const stats = await getStats({
    userId: req.userId,
    from,
    to,
    groupBy: parsed.data.groupBy,
    timezone: parsed.data.timezone,
  });
  res.json(stats);
});

export default router;
