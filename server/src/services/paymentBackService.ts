import { Obligation } from '../models/Obligation.js';
import { PaymentBack } from '../models/PaymentBack.js';
import { currencyMatches, normalizeCurrency } from '../lib/currency.js';

export interface AllocationLine {
  obligationId: string;
  amountApplied: number;
}

export interface CurrencyObligationSummary {
  currency: string;
  totalDue: number;
  paid: number;
  remaining: number;
  openCount: number;
}

function obligationStatus(paid: number, totalDue: number): 'pending' | 'partial' | 'fulfilled' {
  if (paid <= 0) return 'pending';
  if (paid >= totalDue) return 'fulfilled';
  return 'partial';
}

export async function getEntityObligationSummariesByCurrency(
  userId: string,
  entityId: string,
  entityDefaultCurrency = 'PKR'
): Promise<CurrencyObligationSummary[]> {
  const obligations = await Obligation.find({
    userId,
    entityId,
    status: { $in: ['pending', 'partial'] },
  });

  const map = new Map<string, { totalDue: number; paid: number; openCount: number }>();

  for (const o of obligations) {
    const currency = normalizeCurrency(o.currency, entityDefaultCurrency);
    if (!map.has(currency)) map.set(currency, { totalDue: 0, paid: 0, openCount: 0 });
    const bucket = map.get(currency)!;
    bucket.totalDue += o.totalDue;
    bucket.paid += o.paid;
    bucket.openCount += 1;
  }

  return [...map.entries()]
    .map(([currency, { totalDue, paid, openCount }]) => ({
      currency,
      totalDue,
      paid,
      remaining: totalDue - paid,
      openCount,
    }))
    .filter((row) => row.remaining > 0 || row.openCount > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function getEntityObligationSummary(
  userId: string,
  entityId: string,
  entityDefaultCurrency = 'PKR'
) {
  const rows = await getEntityObligationSummariesByCurrency(
    userId,
    entityId,
    entityDefaultCurrency
  );
  const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  const remaining = totalDue - paid;
  const openCount = rows.reduce((s, r) => s + r.openCount, 0);
  return { totalDue, paid, remaining, openCount, byCurrency: rows };
}

export async function allocateFifo(
  userId: string,
  entityId: string,
  totalAmount: number,
  currency: string,
  entityDefaultCurrency = 'PKR'
): Promise<AllocationLine[]> {
  const obligations = await Obligation.find({
    userId,
    entityId,
    status: { $in: ['pending', 'partial'] },
  }).sort({ createdAt: 1 });

  const allocations: AllocationLine[] = [];
  let remaining = totalAmount;
  const targetCurrency = normalizeCurrency(currency, entityDefaultCurrency);

  for (const obligation of obligations) {
    if (remaining <= 0) break;
    if (!currencyMatches(obligation.currency, targetCurrency, entityDefaultCurrency)) continue;

    const owed = obligation.totalDue - obligation.paid;
    if (owed <= 0) continue;

    const applied = Math.min(remaining, owed);
    obligation.paid += applied;
    obligation.status = obligationStatus(obligation.paid, obligation.totalDue);
    if (!obligation.currency) {
      obligation.currency = targetCurrency;
    }
    await obligation.save();

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
  currency: string;
  date: Date;
  entityDefaultCurrency?: string;
}) {
  const entityDefault = input.entityDefaultCurrency ?? 'PKR';
  const currency = normalizeCurrency(input.currency, entityDefault);

  const allocations = await allocateFifo(
    input.userId,
    input.entityId,
    input.totalAmount,
    currency,
    entityDefault
  );

  const [paymentBack] = await PaymentBack.create([
    {
      userId: input.userId,
      entityId: input.entityId,
      transactionId: input.transactionId,
      totalAmount: input.totalAmount,
      currency,
      date: input.date,
      allocations,
    },
  ]);

  return {
    paymentBack,
    allocations,
    unallocated: input.totalAmount - allocations.reduce((s, a) => s + a.amountApplied, 0),
  };
}
