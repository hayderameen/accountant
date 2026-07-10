import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type EntityWithBalances, type Transaction } from "../api/client";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanCurrencySummary } from "../components/LoanCurrencySummary";
import { TransactionItem } from "../components/TransactionItem";
import { SkeletonList, SkeletonSummary } from "../components/Skeleton";
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

export function DashboardPage() {
  const [pendingLoans, setPendingLoans] = useState<EntityWithBalances[]>([]);
  const [takeBack, setTakeBack]         = useState<EntityWithBalances[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deleteError, setDeleteError]   = useState("");
  const [loading, setLoading]           = useState(true);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    return Promise.all([
      api.getEntities("i_owe"),
      api.getEntities("they_owe_me"),
      api.getTransactions(),
    ]).then(([pending, takeback, txns]) => {
      setPendingLoans(pending);
      setTakeBack(takeback);
      setTransactions(txns.slice(0, 5));
    }).finally(() => {
      if (showLoading) setLoading(false);
    });
  };

  useEffect(() => { load(true); }, []);

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

  const pendingTotals = useMemo(() => flattenEntityBalances(pendingLoans), [pendingLoans]);
  const takeBackTotals = useMemo(() => flattenEntityBalances(takeBack), [takeBack]);

  return (
    <div className="space-y-7">
      {/* ── Header ── */}
      <div className="fade-up">
        <p className="section-label mb-1.5">Overview</p>
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* ── Pending loans ── */}
      <section className="fade-up fade-up-delay-1">
        <SectionHeader label="Pending loans" linkTo="/loans" />
        {loading ? (
          <>
            <SkeletonSummary />
            <SkeletonList count={3} subtitle={false} />
          </>
        ) : <>
          <LoanCurrencySummary title="Total remaining" totals={pendingTotals} variant="owed" />
          <div className="space-y-2">
          {pendingLoans.length === 0 ? (
            <EmptyState text="Nothing owed yet." />
          ) : (
            pendingLoans.map((e) => (
              <Link key={e._id} to={`/loans/${e._id}`} className="list-row">
                <span style={{ fontWeight: 500, color: "var(--color-paper)" }}>
                  {e.name}
                </span>
                <EntityBalanceLines balances={e.balancesByCurrency} variant="owed" />
              </Link>
            ))
          )}
          </div>
        </>}
      </section>

      {/* ── Money to take back ── */}
      <section className="fade-up fade-up-delay-2">
        <SectionHeader label="Money to take back" linkTo="/loans" />
        {loading ? (
          <>
            <SkeletonSummary />
            <SkeletonList count={3} subtitle={false} />
          </>
        ) : <>
          <LoanCurrencySummary title="Total owed to you" totals={takeBackTotals} variant="owedToYou" />
          <div className="space-y-2">
          {takeBack.length === 0 ? (
            <EmptyState text="No one owes you yet." />
          ) : (
            takeBack.map((e) => (
              <Link key={e._id} to={`/loans/${e._id}`} className="list-row">
                <span style={{ fontWeight: 500, color: "var(--color-paper)" }}>
                  {e.name}
                </span>
                <EntityBalanceLines balances={e.balancesByCurrency} variant="owedToYou" />
              </Link>
            ))
          )}
          </div>
        </>}
      </section>

      {/* ── Recent transactions ── */}
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
        {loading ? <SkeletonList count={4} /> : <div className="space-y-2">
          {transactions.length === 0 ? (
            <EmptyState text="No transactions yet." />
          ) : (
            transactions.map((t) => (
              <TransactionItem key={t._id} transaction={t} onDelete={handleDelete} />
            ))
          )}
        </div>}
      </section>
    </div>
  );
}
