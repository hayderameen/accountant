import { LoanTransaction } from '../models/LoanTransaction.js';

export async function getLoanBalance(userId: string, entityId: string): Promise<number> {
  const txns = await LoanTransaction.find({ userId, entityId });

  let balance = 0;
  for (const t of txns) {
    if (t.type === 'loan_given') balance += t.amount;
    if (t.type === 'repayment_received') balance -= t.amount;
    if (t.type === 'loan_received') balance += t.amount;
    if (t.type === 'repayment_made') balance -= t.amount;
  }

  return balance;
}
