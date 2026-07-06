import type { Transaction } from "../api/client";
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

export function transactionCurrency(
  t: Transaction,
  fallback = FALLBACK_CURRENCY,
): string {
  return t.currency ?? fallback;
}
