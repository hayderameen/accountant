import { formatMoney } from '../api/client';
import type { ActivityCurrencyTotals } from '../lib/groupActivity';

export function ActivityMonthSummary({
  title,
  byCurrency,
}: {
  title: string;
  byCurrency: ActivityCurrencyTotals[];
}) {
  if (byCurrency.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2.5">
      <p className="mb-2 text-sm font-semibold text-zinc-200">{title}</p>
      <div className="space-y-2">
        {byCurrency.map(({ currency, added, paid }) => (
          <div key={currency}>
            <p className="text-xs font-medium text-zinc-500">{currency}</p>
            <div className="flex flex-wrap gap-x-4 text-sm">
              <span className="text-rose-400">+{formatMoney(added, currency)}</span>
              <span className="text-emerald-400">-{formatMoney(paid, currency)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
