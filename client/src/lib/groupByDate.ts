export interface DatedItem {
  date: string | Date;
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

export interface MonthGroupGeneric<T> {
  key: string;
  label: string;
  days: DayGroup<T>[];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(d: Date): string {
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function groupByMonthAndDay<T extends DatedItem>(items: T[]): MonthGroupGeneric<T>[] {
  const monthMap = new Map<string, Map<string, T[]>>();

  for (const item of items) {
    const date = new Date(item.date);
    const mKey = monthKey(date);
    const dKey = dayKey(date);

    if (!monthMap.has(mKey)) monthMap.set(mKey, new Map());
    const dayMap = monthMap.get(mKey)!;
    if (!dayMap.has(dKey)) dayMap.set(dKey, []);
    dayMap.get(dKey)!.push(item);
  }

  const months: MonthGroupGeneric<T>[] = [];

  for (const [mKey, dayMap] of monthMap) {
    const [year, month] = mKey.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const days: DayGroup<T>[] = [];

    const sortedDays = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));

    for (const dKey of sortedDays) {
      const dayItems = dayMap.get(dKey)!;
      const [, , day] = dKey.split('-').map(Number);
      const dayDate = new Date(year, month - 1, day);
      days.push({
        key: dKey,
        label: formatDayLabel(dayDate),
        items: dayItems.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      });
    }

    months.push({
      key: mKey,
      label: formatMonthLabel(monthDate),
      days,
    });
  }

  return months.sort((a, b) => b.key.localeCompare(a.key));
}
