import type { CurrencyBalance } from '../api/client';
import { FALLBACK_CURRENCY } from './currencies';

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export function sumByCurrency(
  items: { currency?: string; amount: number }[]
): CurrencyAmount[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const c = item.currency ?? FALLBACK_CURRENCY;
    map.set(c, (map.get(c) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function flattenEntityBalances(
  entities: { balancesByCurrency: CurrencyBalance[] }[]
): CurrencyAmount[] {
  return sumByCurrency(
    entities.flatMap((e) =>
      e.balancesByCurrency.map((b) => ({
        currency: b.currency,
        amount: b.balance,
      }))
    )
  );
}

export function balanceForCurrency(
  entity: { balancesByCurrency: CurrencyBalance[] },
  currency: string
): number {
  return entity.balancesByCurrency.find((b) => b.currency === currency)?.balance ?? 0;
}
