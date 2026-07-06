import type { ClientSession } from 'mongoose';
import { Automation } from '../models/Automation.js';
import { Obligation } from '../models/Obligation.js';
import { User } from '../models/User.js';

function toCents(amount: number): number {
  return Math.round(amount);
}

export async function onIncomeCreated(
  userId: string,
  transactionId: string,
  amountCents: number,
  source: string,
  session: ClientSession
) {
  if (source === 'money_manager') {
    const user = await User.findById(userId).session(session);
    if (!user?.settings?.runAutomationsOnImport) return;
  }

  const rules = await Automation.find({ userId, active: true, trigger: 'on_income' }).session(session);

  if (rules.length === 0) return;

  const obligations = rules.map((rule) => ({
    userId,
    entityId: rule.targetEntityId,
    sourceTransactionId: transactionId,
    automationId: rule._id,
    totalDue: toCents((amountCents * rule.percentage) / 100),
    paid: 0,
    status: 'pending' as const,
  }));

  await Obligation.insertMany(obligations, { session });
}
