import { formatMoney } from '../api/client';
import type { CurrencyBalance } from '../api/client';

interface EntityBalanceLinesProps {
  balances: CurrencyBalance[];
  variant: 'owed' | 'owedToYou';
}

export function EntityBalanceLines({ balances, variant }: EntityBalanceLinesProps) {
  const color = variant === 'owed' ? 'text-rose-300' : 'text-emerald-300';

  if (balances.length === 0) {
    return <p className="text-sm text-zinc-500">—</p>;
  }

  return (
    <div className="space-y-0.5 text-right">
      {balances.map((b) => (
        <p key={b.currency} className={`text-sm font-medium ${color}`}>
          {formatMoney(b.balance, b.currency)}
        </p>
      ))}
    </div>
  );
}
