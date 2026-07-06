import { useEffect, useState } from 'react';
import { api, formatMoney, type Account, type Transaction } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { TransactionItem } from '../components/TransactionItem';

export function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.settings?.defaultCurrency ?? 'USD';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    Promise.all([api.getAccounts(), api.getTransactions()]).then(([a, t]) => {
      setAccounts(a);
      setTransactions(t.slice(0, 5));
    });
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm text-zinc-400">Total balance</h2>
        <p className="text-3xl font-semibold">{formatMoney(totalBalance, currency)}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-zinc-400">Accounts</h2>
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-sm text-zinc-500">No accounts yet. Add one from Add.</p>
          ) : (
            accounts.map((a) => (
              <div key={a._id} className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2">
                <span>{a.name}</span>
                <span>{formatMoney(a.balance, a.currency)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-zinc-400">Recent</h2>
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <p className="text-sm text-zinc-500">No transactions yet.</p>
          ) : (
            transactions.map((t) => (
              <TransactionItem key={t._id} transaction={t} currency={currency} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
