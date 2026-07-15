import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Transaction } from "../api/client";
import { TransactionItem } from "../components/TransactionItem";
import { SkeletonList } from "../components/Skeleton";
import { LoadingLabel } from "../components/LoadingLabel";
import { useCachedQuery } from "../hooks/useDataSync";
import { groupByMonthAndDay } from "../lib/groupTransactions";

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TransactionSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [input, setInput] = useState(query);

  const { data, loading, error } = useCachedQuery<Transaction[]>(
    query ? `search:${query.toLowerCase()}` : null,
    () => api.searchTransactions(query),
    [query],
  );
  const transactions = data ?? [];

  useEffect(() => {
    setInput(query);
  }, [query]);

  const months = useMemo(
    () => groupByMonthAndDay(transactions),
    [transactions],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = input.trim();
    if (!nextQuery) return;
    setSearchParams({ q: nextQuery });
  };

  return (
    <div className="fade-up">
      <button
        type="button"
        onClick={() => navigate("/transactions")}
        className="btn-ghost mb-4"
      >
        ← Back to ledger
      </button>

      <h1 className="page-title mb-4">Search transactions</h1>

      <form
        onSubmit={onSubmit}
        className="mb-5 flex flex-col gap-2"
        aria-busy={loading}
        inert={loading ? true : undefined}
      >
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
            style={{ color: "var(--color-mist)" }}
          >
            <SearchIcon />
          </span>
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Memo, category, account, type…"
            className="field w-full"
            style={{ paddingLeft: 38 }}
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="btn-primary shrink-0"
          disabled={!input.trim() || loading}
        >
          {loading ? <LoadingLabel>Searching…</LoadingLabel> : "Search"}
        </button>
      </form>

      {loading ? (
        <div role="status" aria-label="Searching transactions">
          <SkeletonList count={6} />
        </div>
      ) : error ? (
        <div
          className="rounded-xl px-3 py-2 text-sm"
          style={{
            color: "var(--color-red)",
            background: "rgba(255,69,58,0.08)",
            border: "1px solid rgba(255,69,58,0.18)",
          }}
        >
          {error}
        </div>
      ) : !query ? (
        <p className="muted text-sm">
          Search any text stored with a transaction.
        </p>
      ) : transactions.length === 0 ? (
        <div className="panel p-4">
          <p className="text-paper text-sm">No matches for “{query}”</p>
          <p className="muted mt-1 text-xs">
            Try a memo, category, account, currency, or type.
          </p>
        </div>
      ) : (
        <>
          <p className="section-label mb-4">
            {transactions.length}{" "}
            {transactions.length === 1 ? "result" : "results"} for “{query}”
          </p>
          <div className="space-y-7">
            {months.map((month) => (
              <section key={month.key}>
                <h2 className="text-paper mb-3 text-sm font-semibold">
                  {month.label}
                </h2>
                <div className="space-y-4">
                  {month.days.map((day) => (
                    <div key={day.key}>
                      <p className="section-label mb-2">{day.label}</p>
                      <div className="space-y-2">
                        {day.transactions.map((transaction) => (
                          <TransactionItem
                            key={transaction._id}
                            transaction={transaction}
                            hideDate
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
