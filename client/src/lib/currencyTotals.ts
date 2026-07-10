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
  const map = new Map<string, LoanAmounts>();

  for (const t of transactions) {
    if (!t.entityId) continue;
    const currency = t.currency ?? FALLBACK_CURRENCY;
    if (!map.has(currency)) map.set(currency, emptyLoanAmounts());
    const b = map.get(currency)!;
    // Legacy entity-linked transactions represent i_owe activity.
    if (t.type === "income") b.borrowed += t.amount;
    if (t.type === "expense") b.borrowedRepaid += t.amount;
  }

  return [...map.entries()]
    .filter(([, amounts]) => hasLoanAmounts(amounts))
    .map(([currency, amounts]) => ({ currency, ...amounts }))
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
  /** Money I borrowed. */
  borrowed: number;
  /** Money I lent; others owe this to me. */
  lent: number;
  /** Money I paid back against loans I borrowed. */
  borrowedRepaid: number;
  /** Money others repaid against loans I gave. */
  lentRepaid: number;
}

type LoanAmounts = Omit<LoanCurrencyTotals, "currency">;

function emptyLoanAmounts(): LoanAmounts {
  return { borrowed: 0, lent: 0, borrowedRepaid: 0, lentRepaid: 0 };
}

function hasLoanAmounts(amounts: LoanAmounts): boolean {
  return Object.values(amounts).some((amount) => amount > 0);
}

/**
 * Computes loan totals from Obligation records (i_owe direction loans).
 * Each obligation's totalDue counts as a loan taken in that currency.
 */
export function obligationLoanTotals(obligations: Obligation[]): LoanCurrencyTotals[] {
  const map = new Map<string, LoanAmounts>();
  for (const o of obligations) {
    const c = o.currency ?? FALLBACK_CURRENCY;
    if (!map.has(c)) map.set(c, emptyLoanAmounts());
    map.get(c)!.borrowed += o.totalDue;
  }
  return [...map.entries()]
    .filter(([, amounts]) => hasLoanAmounts(amounts))
    .map(([currency, amounts]) => ({ currency, ...amounts }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function loanTotalsByCurrency(loans: LoanTransaction[]): LoanCurrencyTotals[] {
  const map = new Map<string, LoanAmounts>();
  for (const l of loans) {
    const c = l.currency ?? FALLBACK_CURRENCY;
    if (!map.has(c)) map.set(c, emptyLoanAmounts());
    const b = map.get(c)!;
    if (l.type === "loan_given") b.lent += l.amount;
    if (l.type === "loan_received") b.borrowed += l.amount;
    if (l.type === "repayment_made") b.borrowedRepaid += l.amount;
    if (l.type === "repayment_received") b.lentRepaid += l.amount;
  }
  return [...map.entries()]
    .filter(([, amounts]) => hasLoanAmounts(amounts))
    .map(([currency, amounts]) => ({ currency, ...amounts }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
