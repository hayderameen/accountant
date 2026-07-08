import { formatMoney } from '../api/client';
import type { CurrencyAmount } from '../lib/loanTotals';

interface LoanCurrencySummaryProps {
  title: string;
  totals: CurrencyAmount[];
  variant: 'owed' | 'owedToYou';
}

export function LoanCurrencySummary({
  title,
  totals,
  variant,
}: LoanCurrencySummaryProps) {
  if (totals.length === 0) return null;

  const color = variant === 'owed' ? 'text-rose-300' : 'text-emerald-300';

  return (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2.5">
      <p className="mb-2 text-sm font-semibold text-zinc-200">{title}</p>
      <div className="space-y-2">
        {totals.map(({ currency, amount }) => (
          <div key={currency}>
            <p className="text-xs font-medium text-zinc-500">{currency}</p>
            <p className={`text-sm font-medium ${color}`}>
              {formatMoney(amount, currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
