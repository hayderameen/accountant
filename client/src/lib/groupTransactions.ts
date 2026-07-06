import type { Transaction } from '../api/client';

export interface DayGroup {
  key: string;
  label: string;
  transactions: Transaction[];
}

export interface MonthGroup {
  key: string;
  label: string;
  income: number;
  expense: number;
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

    let income = 0;
    let expense = 0;
    const days: DayGroup[] = [];

    const sortedDays = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));

    for (const dKey of sortedDays) {
      const txns = dayMap.get(dKey)!;
      for (const t of txns) {
        if (t.type === 'income') income += t.amount;
        if (t.type === 'expense') expense += t.amount;
      }

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
      income,
      expense,
      days,
    });
  }

  return months.sort((a, b) => b.key.localeCompare(a.key));
}

export function toApiDate(d: Date): string {
  return d.toISOString();
}
