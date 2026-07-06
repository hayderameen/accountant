import { Router } from "express";
import { z } from "zod";
import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { requireAuth } from "../middleware/auth.js";
import { stripUserId } from "../middleware/stripUserId.js";
import { onIncomeCreated } from "../services/automationEngine.js";
import { Entity } from "../models/Entity.js";
import { User } from "../models/User.js";
import { resolveCurrency } from "../lib/currency.js";
import { recordPaymentBack } from "../services/paymentBackService.js";

const router = Router();
router.use(requireAuth, stripUserId);

const transactionSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive(),
  date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  accountId: z.string(),
  categoryId: z.string().optional(),
  toAccountId: z.string().optional(),
  entityId: z.string().optional(),
  currency: z.string().optional(),
  memo: z.string().optional(),
});

function applyBalanceDelta(type: string, amount: number): number {
  if (type === "income") return amount;
  if (type === "expense") return -amount;
  return 0;
}

router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = { userId: req.userId };

  if (req.query.accountId) filter.accountId = req.query.accountId;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from)
      (filter.date as Record<string, Date>).$gte = new Date(
        req.query.from as string,
      );
    if (req.query.to)
      (filter.date as Record<string, Date>).$lte = new Date(
        req.query.to as string,
      );
  }

  const hasDateRange = req.query.from || req.query.to;
  const limit = hasDateRange ? 5000 : 200;

  const transactions = await Transaction.find(filter)
    .sort({ date: -1 })
    .populate("accountId", "name")
    .populate("categoryId", "name type")
    .populate("toAccountId", "name")
    .limit(limit);

  res.json(transactions);
});

router.post("/", async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const amountCents = Math.round(data.amount);

  if (data.type === "transfer" && !data.toAccountId) {
    res.status(400).json({ error: "toAccountId required for transfers" });
    return;
  }

  const account = await Account.findOne({
    _id: data.accountId,
    userId: req.userId,
  });
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const user = await User.findById(req.userId).select(
    "settings.defaultCurrency",
  );
  const currency = resolveCurrency(
    data.currency,
    account.currency,
    user?.settings?.defaultCurrency ?? "PKR",
  );

  if (data.type === "transfer") {
    const toAccount = await Account.findOne({
      _id: data.toAccountId,
      userId: req.userId,
    });
    if (!toAccount) {
      res.status(404).json({ error: "Destination account not found" });
      return;
    }
    account.balance -= amountCents;
    toAccount.balance += amountCents;
    await account.save();
    await toAccount.save();
  } else {
    account.balance += applyBalanceDelta(data.type, amountCents);
    await account.save();
  }

  const transaction = await Transaction.create({
    userId: req.userId,
    type: data.type,
    amount: amountCents,
    date: new Date(data.date),
    accountId: data.accountId,
    categoryId: data.categoryId,
    toAccountId: data.toAccountId,
    entityId: data.entityId,
    currency,
    memo: data.memo,
  });

  if (data.type === "income") {
    await onIncomeCreated(
      req.userId,
      transaction._id.toString(),
      amountCents,
      "app",
    );
  }

  if (data.type === "expense" && data.entityId) {
    const entity = await Entity.findOne({
      _id: data.entityId,
      userId: req.userId,
    });
    if (!entity) {
      res.status(400).json({ error: "Entity not found" });
      return;
    }

    if (entity.currency !== currency) {
      res.status(400).json({
        error: `Transaction currency (${currency}) must match loan currency (${entity.currency})`,
      });
      return;
    }

    if (entity.direction === "i_owe") {
      await recordPaymentBack({
        userId: req.userId,
        entityId: data.entityId,
        transactionId: transaction._id.toString(),
        totalAmount: amountCents,
        date: new Date(data.date),
      });
    }
  }

  res.status(201).json(transaction);
});

export default router;
