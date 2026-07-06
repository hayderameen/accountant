import { useEffect, useState } from 'react';
import { api, formatMoney, type Transaction } from '../api/client';

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    api.getTransactions().then(setTransactions);
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Transactions</h1>
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          transactions.map((t) => (
            <div key={t._id} className="rounded-lg bg-zinc-900 px-3 py-2">
              <div className="flex justify-between">
                <span className="capitalize">{t.type}</span>
                <span className={t.type === 'income' ? 'text-emerald-400' : ''}>
                  {t.type === 'expense' ? '-' : ''}{formatMoney(t.amount)}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                {new Date(t.date).toLocaleDateString()}
                {t.memo ? ` · ${t.memo}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
