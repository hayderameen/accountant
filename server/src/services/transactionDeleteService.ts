import { Account } from '../models/Account.js';
import { Obligation } from '../models/Obligation.js';
import { PaymentBack } from '../models/PaymentBack.js';
import { Transaction } from '../models/Transaction.js';
import type { TransactionDoc } from '../models/Transaction.js';

function obligationStatus(
  paid: number,
  totalDue: number
): 'pending' | 'partial' | 'fulfilled' {
  if (paid <= 0) return 'pending';
  if (paid >= totalDue) return 'fulfilled';
  return 'partial';
}

async function reversePaymentBack(userId: string, transactionId: string) {
  const paymentBack = await PaymentBack.findOne({ userId, transactionId });
  if (!paymentBack) return;

  for (const alloc of paymentBack.allocations) {
    const obligation = await Obligation.findOne({ _id: alloc.obligationId, userId });
    if (!obligation) continue;
    obligation.paid = Math.max(0, obligation.paid - alloc.amountApplied);
    obligation.status = obligationStatus(obligation.paid, obligation.totalDue);
    await obligation.save();
  }

  await PaymentBack.deleteOne({ _id: paymentBack._id });
}

async function deleteIncomeObligations(userId: string, transactionId: string) {
  const obligations = await Obligation.find({ userId, sourceTransactionId: transactionId });
  const paid = obligations.filter((o) => o.paid > 0);

  if (paid.length > 0) {
    throw new Error(
      'Cannot delete this income: payments were already applied to pending loans from it. Delete those expense payments first.'
    );
  }

  await Obligation.deleteMany({ userId, sourceTransactionId: transactionId });
}

async function reverseAccountBalances(transaction: TransactionDoc, userId: string) {
  const amount = transaction.amount;

  if (transaction.type === 'transfer') {
    const account = await Account.findOne({ _id: transaction.accountId, userId });
    const toAccount = transaction.toAccountId
      ? await Account.findOne({ _id: transaction.toAccountId, userId })
      : null;
    if (account) {
      account.balance += amount;
      await account.save();
    }
    if (toAccount) {
      toAccount.balance -= amount;
      await toAccount.save();
    }
    return;
  }

  const account = await Account.findOne({ _id: transaction.accountId, userId });
  if (!account) return;

  if (transaction.type === 'income') account.balance -= amount;
  if (transaction.type === 'expense') account.balance += amount;
  await account.save();
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const transaction = await Transaction.findOne({ _id: transactionId, userId });
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.type === 'income') {
    await deleteIncomeObligations(userId, transactionId);
  }

  if (transaction.type === 'expense') {
    await reversePaymentBack(userId, transactionId);
  }

  await reverseAccountBalances(transaction, userId);
  await Transaction.deleteOne({ _id: transaction._id });

  return { ok: true };
}
