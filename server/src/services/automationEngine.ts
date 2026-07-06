import { Automation } from "../models/Automation.js";
import { Entity } from "../models/Entity.js";
import { Obligation } from "../models/Obligation.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";

function toCents(amount: number): number {
  return Math.round(amount);
}

export async function onIncomeCreated(
  userId: string,
  transactionId: string,
  amountCents: number,
  source: string,
) {
  if (source === "money_manager") {
    const user = await User.findById(userId);
    if (!user?.settings?.runAutomationsOnImport) return;
  }

  const rules = await Automation.find({
    userId,
    active: true,
    trigger: "on_income",
  });
  if (rules.length === 0) return;

  const income = await Transaction.findOne({ _id: transactionId, userId });
  const incomeCurrency = income?.currency ?? "PKR";

  const obligations = [];
  for (const rule of rules) {
    const entity = await Entity.findOne({ _id: rule.targetEntityId, userId });
    if (!entity || entity.currency !== incomeCurrency) continue;

    obligations.push({
      userId,
      entityId: rule.targetEntityId,
      sourceTransactionId: transactionId,
      automationId: rule._id,
      totalDue: toCents((amountCents * rule.percentage) / 100),
      paid: 0,
      status: "pending" as const,
    });
  }

  if (obligations.length === 0) return;

  await Obligation.insertMany(obligations);
}
