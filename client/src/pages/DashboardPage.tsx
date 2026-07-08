import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type EntityWithBalances,
  type Transaction,
} from "../api/client";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanCurrencySummary } from "../components/LoanCurrencySummary";
import { TransactionItem } from "../components/TransactionItem";
import { flattenEntityBalances } from "../lib/loanTotals";

export function DashboardPage() {
  const [pendingLoans, setPendingLoans] = useState<EntityWithBalances[]>([]);
  const [takeBack, setTakeBack] = useState<EntityWithBalances[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deleteError, setDeleteError] = useState("");

  const load = () =>
    Promise.all([
      api.getEntities("i_owe"),
      api.getEntities("they_owe_me"),
      api.getTransactions(),
    ]).then(([pending, takeback, txns]) => {
      setPendingLoans(pending);
      setTakeBack(takeback);
      setTransactions(txns.slice(0, 5));
    });

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    setDeleteError("");
    try {
      await api.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t._id !== id));
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const pendingTotals = useMemo(
    () => flattenEntityBalances(pendingLoans),
    [pendingLoans],
  );

  const takeBackTotals = useMemo(
    () => flattenEntityBalances(takeBack),
    [takeBack],
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm text-zinc-400">Pending Loans</h2>
          <Link
            to="/loans"
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            View all
          </Link>
        </div>
        <LoanCurrencySummary
          title="Total remaining"
          totals={pendingTotals}
          variant="owed"
        />
        <div className="space-y-2">
          {pendingLoans.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing owed yet.</p>
          ) : (
            pendingLoans.map((e) => (
              <Link
                key={e._id}
                to={`/loans/${e._id}`}
                className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2.5 hover:bg-zinc-800"
              >
                <p className="font-medium">{e.name}</p>
                <EntityBalanceLines
                  balances={e.balancesByCurrency}
                  variant="owed"
                />
              </Link>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm text-zinc-400">Money to Take Back</h2>
          <Link
            to="/loans"
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            View all
          </Link>
        </div>
        <LoanCurrencySummary
          title="Total owed to you"
          totals={takeBackTotals}
          variant="owedToYou"
        />
        <div className="space-y-2">
          {takeBack.length === 0 ? (
            <p className="text-sm text-zinc-500">No one owes you yet.</p>
          ) : (
            takeBack.map((e) => (
              <Link
                key={e._id}
                to={`/loans/${e._id}`}
                className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2.5 hover:bg-zinc-800"
              >
                <p className="font-medium">{e.name}</p>
                <EntityBalanceLines
                  balances={e.balancesByCurrency}
                  variant="owedToYou"
                />
              </Link>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-zinc-400">Recent</h2>
        {deleteError && (
          <p className="mb-2 text-sm text-red-400">{deleteError}</p>
        )}
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <p className="text-sm text-zinc-500">No transactions yet.</p>
          ) : (
            transactions.map((t) => (
              <TransactionItem
                key={t._id}
                transaction={t}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
