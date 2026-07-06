import { formatMoney, type EntityActivityItem } from '../api/client';

interface LoanActivityItemProps {
  item: EntityActivityItem;
}

export function LoanActivityItem({ item }: LoanActivityItemProps) {
  const sign = item.type === 'add' ? '+' : '-';
  const color = item.type === 'add' ? 'text-rose-400' : 'text-emerald-400';

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{item.label}</p>
        {item.memo && <p className="mt-0.5 truncate text-xs text-zinc-500">{item.memo}</p>}
      </div>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${color}`}>
        {sign}
        {formatMoney(item.amount, item.currency)}
      </p>
    </div>
  );
}
