import { LoanTransaction } from '../models/LoanTransaction.js';
import { normalizeCurrency } from '../lib/currency.js';

export interface CurrencyBalance {
  currency: string;
  balance: number;
}

function loanDelta(type: string, amount: number): number {
  if (type === 'loan_given' || type === 'loan_received') return amount;
  if (type === 'repayment_received' || type === 'repayment_made') return -amount;
  return 0;
}

export async function getLoanBalancesByCurrency(
  userId: string,
  entityId: string,
  entityDefaultCurrency = 'PKR'
): Promise<CurrencyBalance[]> {
  const txns = await LoanTransaction.find({ userId, entityId });
  const map = new Map<string, number>();

  for (const t of txns) {
    const currency = normalizeCurrency(t.currency, entityDefaultCurrency);
    map.set(currency, (map.get(currency) ?? 0) + loanDelta(t.type, t.amount));
  }

  return [...map.entries()]
    .map(([currency, balance]) => ({ currency, balance }))
    .filter((row) => row.balance !== 0)
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function getLoanBalanceForCurrency(
  userId: string,
  entityId: string,
  currency: string,
  entityDefaultCurrency = 'PKR'
): Promise<number> {
  const target = normalizeCurrency(currency, entityDefaultCurrency);
  const rows = await getLoanBalancesByCurrency(userId, entityId, entityDefaultCurrency);
  return rows.find((row) => row.currency === target)?.balance ?? 0;
}

export function assertRepaymentWithinBalance(
  amount: number,
  balance: number,
  currency: string
): void {
  if (amount > balance) {
    throw new Error(
      `Repayment cannot exceed ${(balance / 100).toFixed(2)} ${currency} owed`
    );
  }
}

/** @deprecated use getLoanBalancesByCurrency */
export async function getLoanBalance(userId: string, entityId: string): Promise<number> {
  const rows = await getLoanBalancesByCurrency(userId, entityId);
  return rows.reduce((sum, row) => sum + row.balance, 0);
}
