import type { EntityActivityItem } from '../api/client';
import { groupByMonthAndDay } from './groupByDate';

export interface ActivityCurrencyTotals {
  currency: string;
  added: number;
  paid: number;
}

export interface ActivityMonthGroup {
  key: string;
  label: string;
  byCurrency: ActivityCurrencyTotals[];
  days: ReturnType<typeof groupByMonthAndDay<EntityActivityItem>>[number]['days'];
}

function totalsForItems(items: EntityActivityItem[]): ActivityCurrencyTotals[] {
  const map = new Map<string, { added: number; paid: number }>();
  for (const item of items) {
    if (!map.has(item.currency)) map.set(item.currency, { added: 0, paid: 0 });
    const bucket = map.get(item.currency)!;
    if (item.type === 'add') bucket.added += item.amount;
    else bucket.paid += item.amount;
  }
  return [...map.entries()]
    .map(([currency, { added, paid }]) => ({ currency, added, paid }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function groupActivityByMonthAndDay(
  items: EntityActivityItem[]
): ActivityMonthGroup[] {
  const months = groupByMonthAndDay(items);
  return months.map((month) => {
    const monthItems = month.days.flatMap((day) => day.items);
    return {
      key: month.key,
      label: month.label,
      byCurrency: totalsForItems(monthItems),
      days: month.days,
    };
  });
}
