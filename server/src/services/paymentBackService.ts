import type { ClientSession } from 'mongoose';
import { Obligation } from '../models/Obligation.js';
import { PaymentBack } from '../models/PaymentBack.js';

export interface AllocationLine {
  obligationId: string;
  amountApplied: number;
}

function obligationStatus(paid: number, totalDue: number): 'pending' | 'partial' | 'fulfilled' {
  if (paid <= 0) return 'pending';
  if (paid >= totalDue) return 'fulfilled';
  return 'partial';
}

export async function allocateFifo(
  userId: string,
  entityId: string,
  totalAmount: number,
  session: ClientSession
): Promise<AllocationLine[]> {
  const obligations = await Obligation.find({
    userId,
    entityId,
    status: { $in: ['pending', 'partial'] },
  })
    .sort({ createdAt: 1 })
    .session(session);

  const allocations: AllocationLine[] = [];
  let remaining = totalAmount;

  for (const obligation of obligations) {
    if (remaining <= 0) break;

    const owed = obligation.totalDue - obligation.paid;
    if (owed <= 0) continue;

    const applied = Math.min(remaining, owed);
    obligation.paid += applied;
    obligation.status = obligationStatus(obligation.paid, obligation.totalDue);
    await obligation.save({ session });

    allocations.push({
      obligationId: obligation._id.toString(),
      amountApplied: applied,
    });
    remaining -= applied;
  }

  return allocations;
}

export async function recordPaymentBack(input: {
  userId: string;
  entityId: string;
  transactionId: string;
  totalAmount: number;
  date: Date;
  session: ClientSession;
}) {
  const allocations = await allocateFifo(
    input.userId,
    input.entityId,
    input.totalAmount,
    input.session
  );

  const [paymentBack] = await PaymentBack.create(
    [
      {
        userId: input.userId,
        entityId: input.entityId,
        transactionId: input.transactionId,
        totalAmount: input.totalAmount,
        date: input.date,
        allocations,
      },
    ],
    { session: input.session }
  );

  return { paymentBack, allocations, unallocated: input.totalAmount - allocations.reduce((s, a) => s + a.amountApplied, 0) };
}

export async function getEntityObligationSummary(userId: string, entityId: string) {
  const obligations = await Obligation.find({
    userId,
    entityId,
    status: { $in: ['pending', 'partial'] },
  });

  const totalDue = obligations.reduce((s, o) => s + o.totalDue, 0);
  const paid = obligations.reduce((s, o) => s + o.paid, 0);
  const remaining = totalDue - paid;

  return { totalDue, paid, remaining, openCount: obligations.length };
}
