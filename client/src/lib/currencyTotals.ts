import type { Transaction, LoanTransaction, Obligation } from "../api/client";
import { FALLBACK_CURRENCY } from "./currencies";

export interface CurrencyTotals {
  currency: string;
  income: number;
  expense: number;
}

export function totalsByCurrency(
  transactions: Transaction[],
): CurrencyTotals[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    // Skip entity-linked transactions — they are loan flows shown in the loans box
    if (t.entityId) continue;
    const currency = t.currency ?? FALLBACK_CURRENCY;
    if (!map.has(currency)) map.set(currency, { income: 0, expense: 0 });
    const bucket = map.get(currency)!;
    if (t.type === "income") bucket.income += t.amount;
    if (t.type === "expense") bucket.expense += t.amount;
  }

  return [...map.entries()]
    .map(([currency, { income, expense }]) => ({ currency, income, expense }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Computes loan-like totals from entity-linked income/expense transactions
 * (older records that were saved as regular transactions instead of LoanTransactions).
 */
export function entityTransactionLoanTotals(
  transactions: Transaction[],
): LoanCurrencyTotals[] {
  const map = new Map<string, { taken: number; repaid: number }>();

  for (const t of transactions) {
    if (!t.entityId) continue;
    const currency = t.currency ?? FALLBACK_CURRENCY;
    if (!map.has(currency)) map.set(currency, { taken: 0, repaid: 0 });
    const b = map.get(currency)!;
    // income = money received (loan taken or repayment received)
    // expense = money paid out (loan given or repayment made)
    if (t.type === "income") b.taken += t.amount;
    if (t.type === "expense") b.repaid += t.amount;
  }

  return [...map.entries()]
    .filter(([, { taken, repaid }]) => taken > 0 || repaid > 0)
    .map(([currency, { taken, repaid }]) => ({ currency, taken, repaid }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function transactionCurrency(
  t: Transaction,
  fallback = FALLBACK_CURRENCY,
): string {
  return t.currency ?? fallback;
}

export interface LoanCurrencyTotals {
  currency: string;
  /** sum of loan_given + loan_received (new loans created) */
  taken: number;
  /** sum of repayment_made + repayment_received */
  repaid: number;
}

/**
 * Computes loan totals from Obligation records (i_owe direction loans).
 * Each obligation's totalDue counts as a loan taken in that currency.
 */
export function obligationLoanTotals(obligations: Obligation[]): LoanCurrencyTotals[] {
  const map = new Map<string, { taken: number; repaid: number }>();
  for (const o of obligations) {
    const c = o.currency ?? FALLBACK_CURRENCY;
    if (!map.has(c)) map.set(c, { taken: 0, repaid: 0 });
    map.get(c)!.taken += o.totalDue;
  }
  return [...map.entries()]
    .filter(([, { taken }]) => taken > 0)
    .map(([currency, { taken, repaid }]) => ({ currency, taken, repaid }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function loanTotalsByCurrency(loans: LoanTransaction[]): LoanCurrencyTotals[] {
  const map = new Map<string, { taken: number; repaid: number }>();
  for (const l of loans) {
    const c = l.currency ?? FALLBACK_CURRENCY;
    if (!map.has(c)) map.set(c, { taken: 0, repaid: 0 });
    const b = map.get(c)!;
    if (l.type === "loan_given" || l.type === "loan_received") b.taken += l.amount;
    else b.repaid += l.amount;
  }
  return [...map.entries()]
    .map(([currency, { taken, repaid }]) => ({ currency, taken, repaid }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
