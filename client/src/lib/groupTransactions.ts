import type { Transaction, LoanTransaction, Obligation } from '../api/client';
import { totalsByCurrency, loanTotalsByCurrency, obligationLoanTotals, type CurrencyTotals, type LoanCurrencyTotals } from './currencyTotals';

export interface DayGroup {
  key: string;
  label: string;
  transactions: Transaction[];
}

export interface MonthGroup {
  key: string;
  label: string;
  byCurrency: CurrencyTotals[];
  days: DayGroup[];
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dayKey(d: Date): string {
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function groupByMonthAndDay(transactions: Transaction[]): MonthGroup[] {
  const monthMap = new Map<string, Map<string, Transaction[]>>();

  for (const t of transactions) {
    const date = new Date(t.date);
    const mKey = monthKey(date);
    const dKey = dayKey(date);

    if (!monthMap.has(mKey)) monthMap.set(mKey, new Map());
    const dayMap = monthMap.get(mKey)!;
    if (!dayMap.has(dKey)) dayMap.set(dKey, []);
    dayMap.get(dKey)!.push(t);
  }

  const months: MonthGroup[] = [];

  for (const [mKey, dayMap] of monthMap) {
    const [year, month] = mKey.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const days: DayGroup[] = [];
    const monthTransactions: Transaction[] = [];

    const sortedDays = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));

    for (const dKey of sortedDays) {
      const txns = dayMap.get(dKey)!;
      monthTransactions.push(...txns);

      const [, , day] = dKey.split('-').map(Number);
      const dayDate = new Date(year, month - 1, day);
      days.push({
        key: dKey,
        label: formatDayLabel(dayDate),
        transactions: txns.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      });
    }

    months.push({
      key: mKey,
      label: formatMonthLabel(monthDate),
      byCurrency: totalsByCurrency(monthTransactions),
      days,
    });
  }

  return months.sort((a, b) => b.key.localeCompare(a.key));
}

export function toApiDate(d: Date): string {
  return d.toISOString();
}

/** Merges two LoanCurrencyTotals[] arrays by currency. */
export function mergeLoanTotals(a: LoanCurrencyTotals[], b: LoanCurrencyTotals[]): LoanCurrencyTotals[] {
  const map = new Map<string, Omit<LoanCurrencyTotals, "currency">>();
  for (const { currency, borrowed, lent, borrowedRepaid, lentRepaid } of [...a, ...b]) {
    const existing = map.get(currency) ?? {
      borrowed: 0,
      lent: 0,
      borrowedRepaid: 0,
      lentRepaid: 0,
    };
    map.set(currency, {
      borrowed: existing.borrowed + borrowed,
      lent: existing.lent + lent,
      borrowedRepaid: existing.borrowedRepaid + borrowedRepaid,
      lentRepaid: existing.lentRepaid + lentRepaid,
    });
  }
  return [...map.entries()]
    .map(([currency, amounts]) => ({ currency, ...amounts }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Returns a map of monthKey → LoanCurrencyTotals[] from LoanTransaction records. */
export function groupLoansByMonth(loans: LoanTransaction[]): Map<string, LoanCurrencyTotals[]> {
  const buckets = new Map<string, LoanTransaction[]>();
  for (const l of loans) {
    const k = monthKey(new Date(l.date));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(l);
  }
  const result = new Map<string, LoanCurrencyTotals[]>();
  for (const [k, items] of buckets) {
    result.set(k, loanTotalsByCurrency(items));
  }
  return result;
}

/** Returns a map of monthKey → LoanCurrencyTotals[] from Obligation records (i_owe loans). */
export function groupObligationsByMonth(obligations: Obligation[]): Map<string, LoanCurrencyTotals[]> {
  const buckets = new Map<string, Obligation[]>();
  for (const o of obligations) {
    // Obligations use createdAt as the reference date
    const dateStr = o.createdAt ?? new Date().toISOString();
    const k = monthKey(new Date(dateStr));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(o);
  }
  const result = new Map<string, LoanCurrencyTotals[]>();
  for (const [k, items] of buckets) {
    result.set(k, obligationLoanTotals(items));
  }
  return result;
}
