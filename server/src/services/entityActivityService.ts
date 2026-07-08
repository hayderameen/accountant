import { Obligation } from '../models/Obligation.js';
import { PaymentBack } from '../models/PaymentBack.js';
import { LoanTransaction } from '../models/LoanTransaction.js';
import type { EntityDoc } from '../models/Entity.js';
import { normalizeCurrency } from '../lib/currency.js';

export interface EntityActivityItem {
  _id: string;
  date: Date;
  type: 'add' | 'pay';
  amount: number;
  currency: string;
  label: string;
  memo?: string;
}

export async function getEntityActivity(
  userId: string,
  entity: EntityDoc
): Promise<EntityActivityItem[]> {
  const items: EntityActivityItem[] = [];
  const entityDefault = entity.currency ?? 'PKR';

  if (entity.direction === 'i_owe') {
    const obligations = await Obligation.find({ userId, entityId: entity._id })
      .populate('sourceTransactionId', 'date memo currency')
      .populate('automationId', 'name percentage');

    for (const o of obligations) {
      const src = o.sourceTransactionId as {
        date?: Date;
        memo?: string;
        currency?: string;
      } | null;
      const auto = o.automationId as { name?: string; percentage?: number } | null;
      const currency = normalizeCurrency(
        o.currency ?? src?.currency,
        entityDefault
      );
      const label = auto?.name
        ? `${auto.name} (${auto.percentage}%)`
        : src
          ? 'From income'
          : 'Manual';

      items.push({
        _id: o._id.toString(),
        date: src?.date ?? o.createdAt,
        type: 'add',
        amount: o.totalDue,
        currency,
        label,
        memo: src?.memo,
      });
    }

    const paymentBacks = await PaymentBack.find({
      userId,
      entityId: entity._id,
    }).populate('transactionId', 'date memo currency');

    for (const pb of paymentBacks) {
      const txn = pb.transactionId as {
        date?: Date;
        memo?: string;
        currency?: string;
      } | null;
      items.push({
        _id: pb._id.toString(),
        date: pb.date ?? txn?.date ?? pb.createdAt,
        type: 'pay',
        amount: pb.totalAmount,
        currency: normalizeCurrency(pb.currency ?? txn?.currency, entityDefault),
        label: 'Payment',
        memo: txn?.memo,
      });
    }
  } else {
    const loanTxns = await LoanTransaction.find({
      userId,
      entityId: entity._id,
    }).sort({ date: -1 });

    for (const lt of loanTxns) {
      const isAdd = lt.type === 'loan_given' || lt.type === 'loan_received';
      items.push({
        _id: lt._id.toString(),
        date: lt.date,
        type: isAdd ? 'add' : 'pay',
        amount: lt.amount,
        currency: normalizeCurrency(lt.currency, entityDefault),
        label:
          lt.type === 'loan_given'
            ? 'Loan given'
            : lt.type === 'repayment_received'
              ? 'Repayment received'
              : lt.type === 'loan_received'
                ? 'Loan received'
                : 'Repayment made',
        memo: lt.memo ?? undefined,
      });
    }
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
