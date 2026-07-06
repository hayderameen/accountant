import { formatMoney, type Transaction, type Category } from '../api/client';

function categoryName(categoryId?: Category | string): string | undefined {
  if (categoryId && typeof categoryId === 'object') return categoryId.name;
  return undefined;
}

export function transactionTitle(t: Transaction): string {
  if (t.memo?.trim()) return t.memo.trim();
  const cat = categoryName(t.categoryId);
  if (cat) return cat;
  return t.type.charAt(0).toUpperCase() + t.type.slice(1);
}

export function transactionSubtitle(t: Transaction, opts?: { hideDate?: boolean }): string {
  const parts: string[] = [];
  if (!opts?.hideDate) parts.push(new Date(t.date).toLocaleDateString());
  const cat = categoryName(t.categoryId);
  if (cat) parts.push(cat);
  if (typeof t.accountId === 'object' && t.accountId?.name) parts.push(t.accountId.name);
  return parts.join(' · ');
}

const amountStyles = {
  income: 'text-emerald-400',
  expense: 'text-rose-400',
  transfer: 'text-sky-400',
} as const;

export function signedAmount(t: Transaction, currency: string): string {
  const value = formatMoney(t.amount, currency);
  if (t.type === 'income') return `+${value}`;
  if (t.type === 'expense') return `-${value}`;
  return value;
}

interface TransactionItemProps {
  transaction: Transaction;
  currency: string;
  hideDate?: boolean;
}

export function TransactionItem({ transaction: t, currency, hideDate }: TransactionItemProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{transactionTitle(t)}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{transactionSubtitle(t, { hideDate })}</p>
      </div>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${amountStyles[t.type]}`}>
        {signedAmount(t, currency)}
      </p>
    </div>
  );
}
