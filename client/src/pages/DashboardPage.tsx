import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type EntityWithBalances,
  type LoanTransaction,
  type Transaction,
} from "../api/client";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanCurrencySummary } from "../components/LoanCurrencySummary";
import { LoanTransactionItem } from "../components/LoanTransactionItem";
import { TransactionItem } from "../components/TransactionItem";
import { SkeletonList, SkeletonSummary } from "../components/Skeleton";
import { useCachedQuery } from "../hooks/useDataSync";
import { mergeDayItems } from "../lib/groupTransactions";
import { flattenEntityBalances } from "../lib/loanTotals";

function SectionHeader({
  label,
  linkTo,
}: {
  label: string;
  linkTo?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="section-label">{label}</h2>
      {linkTo && (
        <Link
          to={linkTo}
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "var(--color-sage-bright)",
          }}
          className="hover:underline"
        >
          View all
        </Link>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p style={{ fontSize: "0.875rem", color: "var(--color-mist)" }}>{text}</p>
  );
}

type DashboardData = {
  pendingLoans: EntityWithBalances[];
  takeBack: EntityWithBalances[];
  transactions: Transaction[];
  loans: LoanTransaction[];
};

export function DashboardPage() {
  const [deleteError, setDeleteError] = useState("");
  const { data, loading, reload, setData } = useCachedQuery<DashboardData>(
    "dashboard",
    async () => {
      const [pending, takeback, txns, loanTxns] = await Promise.all([
        api.getEntities("i_owe"),
        api.getEntities("they_owe_me"),
        api.getTransactions(),
        api.getLoanTransactions(),
      ]);
      return {
        pendingLoans: pending,
        takeBack: takeback,
        transactions: txns,
        loans: loanTxns,
      };
    },
  );

  const pendingLoans = data?.pendingLoans ?? [];
  const takeBack = data?.takeBack ?? [];
  const recentItems = useMemo(
    () =>
      mergeDayItems(data?.transactions ?? [], data?.loans ?? []).slice(0, 5),
    [data?.transactions, data?.loans],
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    setDeleteError("");
    try {
      await api.deleteTransaction(id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              transactions: prev.transactions.filter((t) => t._id !== id),
            }
          : prev,
      );
      await reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const activePendingLoans = useMemo(
    () =>
      pendingLoans.filter((entity) =>
        entity.balancesByCurrency.some((balance) => balance.balance > 0),
      ),
    [pendingLoans],
  );
  const activeTakeBack = useMemo(
    () =>
      takeBack.filter((entity) =>
        entity.balancesByCurrency.some((balance) => balance.balance > 0),
      ),
    [takeBack],
  );
  const pendingTotals = useMemo(
    () => flattenEntityBalances(activePendingLoans),
    [activePendingLoans],
  );
  const takeBackTotals = useMemo(
    () => flattenEntityBalances(activeTakeBack),
    [activeTakeBack],
  );

  return (
    <div className="space-y-7">
      <div className="fade-up">
        <p className="section-label mb-1.5">Overview</p>
        <h1 className="page-title">Dashboard</h1>
      </div>

      <section className="fade-up fade-up-delay-1">
        <SectionHeader label="Pending loans" linkTo="/loans" />
        {loading ? (
          <>
            <SkeletonSummary />
            <SkeletonList count={3} subtitle={false} />
          </>
        ) : (
          <>
            <LoanCurrencySummary
              title="Total remaining"
              totals={pendingTotals}
              variant="owed"
            />
            <div className="space-y-2">
              {activePendingLoans.length === 0 ? (
                <EmptyState text="Nothing owed yet." />
              ) : (
                activePendingLoans.map((e) => (
                  <Link key={e._id} to={`/loans/${e._id}`} className="list-row">
                    <span style={{ fontWeight: 500, color: "var(--color-paper)" }}>
                      {e.name}
                    </span>
                    <EntityBalanceLines
                      balances={e.balancesByCurrency}
                      variant="owed"
                    />
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </section>

      <section className="fade-up fade-up-delay-2">
        <SectionHeader label="Money to take back" linkTo="/loans" />
        {loading ? (
          <>
            <SkeletonSummary />
            <SkeletonList count={3} subtitle={false} />
          </>
        ) : (
          <>
            <LoanCurrencySummary
              title="Total owed to you"
              totals={takeBackTotals}
              variant="owedToYou"
            />
            <div className="space-y-2">
              {activeTakeBack.length === 0 ? (
                <EmptyState text="No one owes you yet." />
              ) : (
                activeTakeBack.map((e) => (
                  <Link key={e._id} to={`/loans/${e._id}`} className="list-row">
                    <span style={{ fontWeight: 500, color: "var(--color-paper)" }}>
                      {e.name}
                    </span>
                    <EntityBalanceLines
                      balances={e.balancesByCurrency}
                      variant="owedToYou"
                    />
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </section>

      <section className="fade-up fade-up-delay-3">
        <SectionHeader label="Recent transactions" />
        {deleteError && (
          <p
            className="mb-2 rounded-lg px-3 py-2 text-sm"
            style={{
              color: "var(--color-red)",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.15)",
            }}
          >
            {deleteError}
          </p>
        )}
        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <div className="space-y-2">
            {recentItems.length === 0 ? (
              <EmptyState text="No transactions yet." />
            ) : (
              recentItems.map((item) =>
                item.kind === "transaction" ? (
                  <TransactionItem
                    key={item.id}
                    transaction={item.transaction}
                    onDelete={handleDelete}
                  />
                ) : (
                  <LoanTransactionItem key={item.id} loan={item.loan} />
                ),
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
