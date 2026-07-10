import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  formatMoney,
  type LoanTransaction,
  type Obligation,
  type Transaction,
} from "../api/client";
import {
  endOfMonth,
  formatMonthLabel,
  groupByMonthAndDay,
  groupLoansByMonth,
  groupObligationsByMonth,
  mergeLoanTotals,
  monthKey,
  startOfMonth,
  toApiDate,
  type MonthGroup,
} from "../lib/groupTransactions";
import {
  entityTransactionLoanTotals,
  loanTotalsByCurrency,
  obligationLoanTotals,
  totalsByCurrency,
  type CurrencyTotals,
  type LoanCurrencyTotals,
} from "../lib/currencyTotals";
import { TransactionItem } from "../components/TransactionItem";
import { SkeletonLedger } from "../components/Skeleton";

type RangeMode = "month" | "3m" | "6m" | "year" | "custom";

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function getRange(
  mode: RangeMode,
  viewMonth: Date,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const now = new Date();
  switch (mode) {
    case "month":
      return { from: startOfMonth(viewMonth), to: endOfMonth(viewMonth) };
    case "3m":
      return { from: startOfMonth(shiftMonth(now, -2)), to: endOfMonth(now) };
    case "6m":
      return { from: startOfMonth(shiftMonth(now, -5)), to: endOfMonth(now) };
    case "year":
      return { from: startOfMonth(shiftMonth(now, -11)), to: endOfMonth(now) };
    case "custom":
      return {
        from: customFrom
          ? startOfMonth(new Date(customFrom))
          : startOfMonth(now),
        to: customTo ? endOfMonth(new Date(customTo)) : endOfMonth(now),
      };
  }
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function IncomeExpenseRow({ currency, income, expense }: CurrencyTotals) {
  const net = income - expense;
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-0.5"
      style={{ fontSize: "0.84rem" }}
    >
      <span className="section-label w-full" style={{ marginBottom: 2 }}>
        {currency}
      </span>
      {income > 0 && (
        <span className="amount-in tabular-nums">
          +{formatMoney(income, currency)}
        </span>
      )}
      {expense > 0 && (
        <span className="amount-out tabular-nums">
          −{formatMoney(expense, currency)}
        </span>
      )}
      <span
        className="tabular-nums"
        style={{
          color: net >= 0 ? "var(--color-green)" : "var(--color-red)",
          opacity: 0.7,
          fontSize: "0.79rem",
        }}
      >
        Net {net >= 0 ? "+" : "−"}
        {formatMoney(Math.abs(net), currency)}
      </span>
    </div>
  );
}

function LoanRow({
  currency,
  borrowed,
  lent,
  borrowedRepaid,
  lentRepaid,
}: LoanCurrencyTotals) {
  const metrics = [
    {
      label: "Taken",
      amount: borrowed,
      color: "#ff9f0a",
      background: "rgba(255,159,10,0.09)",
    },
    {
      label: "Owed to me",
      amount: lent,
      color: "var(--color-blue)",
      background: "rgba(100,210,255,0.09)",
    },
    {
      label: "Paid back",
      amount: borrowedRepaid,
      color: "var(--color-red)",
      background: "rgba(255,69,58,0.08)",
    },
    {
      label: "Repaid to me",
      amount: lentRepaid,
      color: "var(--color-green)",
      background: "rgba(48,209,88,0.08)",
    },
  ].filter(({ amount }) => amount > 0);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="section-label">{currency}</span>
        <span
          className="h-px flex-1"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
      </div>
      <div className="grid grid-cols-1 gap-2">
        {metrics.map(({ label, amount, color, background }) => (
          <div
            key={label}
            style={{
              padding: "9px 10px",
              borderRadius: 10,
              background,
              border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
            }}
          >
            <span
              className="block"
              style={{
                color,
                fontSize: "0.61rem",
                fontWeight: 650,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              {label}
            </span>
            <span
              className="block tabular-nums"
              style={{ color, fontSize: "0.88rem", fontWeight: 600 }}
            >
              {formatMoney(amount, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryBox({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={accent ? "panel-accent" : "panel"}
      style={{ padding: "10px 13px", borderRadius: 13 }}
    >
      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          marginBottom: "0.55rem",
          color: accent ? "var(--color-sage-bright)" : "var(--color-mist)",
        }}
      >
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function SummaryBoxPair({
  label,
  byCurrency,
  loanByCurrency,
  accent,
}: {
  label: string;
  byCurrency: CurrencyTotals[];
  loanByCurrency: LoanCurrencyTotals[];
  accent?: boolean;
}) {
  const hasIncome = byCurrency.length > 0;
  const hasLoans = loanByCurrency.length > 0;
  if (!hasIncome && !hasLoans) return null;

  return (
    <div
      className="mb-3 grid gap-2"
      style={{ gridTemplateColumns: hasIncome && hasLoans ? "1fr 1fr" : "1fr" }}
    >
      {hasIncome && (
        <SummaryBox title={label} accent={accent}>
          {byCurrency.map((row) => (
            <IncomeExpenseRow key={row.currency} {...row} />
          ))}
        </SummaryBox>
      )}
      {hasLoans && (
        <SummaryBox title="Loans" accent={accent}>
          {loanByCurrency.map((row) => (
            <LoanRow key={row.currency} {...row} />
          ))}
        </SummaryBox>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

const rangeOptions: { id: RangeMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "3m", label: "3 mo" },
  { id: "6m", label: "6 mo" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

export function TransactionsPage() {
  const navigate = useNavigate();
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanTransaction[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { from, to } = useMemo(
    () => getRange(rangeMode, viewMonth, customFrom, customTo),
    [rangeMode, viewMonth, customFrom, customTo],
  );

  useEffect(() => {
    setLoading(true);
    const fromStr = toApiDate(from);
    const toStr = toApiDate(to);
    Promise.all([
      api.getTransactions({ from: fromStr, to: toStr }),
      api.getLoanTransactions({ from: fromStr, to: toStr }),
      api.getAllObligations({ from: fromStr, to: toStr }),
    ])
      .then(([txns, loanTxns, obls]) => {
        setTransactions(txns);
        setLoans(loanTxns);
        setObligations(obls);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    setDeleteError("");
    try {
      await api.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/transactions/search?q=${encodeURIComponent(query)}`);
  };

  const months = useMemo(
    () => groupByMonthAndDay(transactions),
    [transactions],
  );

  // Per-month loan totals: merge all three sources
  // 1. LoanTransactions (they_owe_me direction: loan_given, repayment_received)
  // 2. Obligations (i_owe direction: loan taken = totalDue)
  // 3. Entity-linked expense Transactions (i_owe direction: repayment made, old records)
  const loansByMonthKey = useMemo(() => {
    const fromLoanTxns = groupLoansByMonth(loans);
    const fromObligations = groupObligationsByMonth(obligations);

    // Group entity-linked regular transactions by month
    const entityByMonth = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (!t.entityId) continue;
      const k = monthKey(new Date(t.date));
      if (!entityByMonth.has(k)) entityByMonth.set(k, []);
      entityByMonth.get(k)!.push(t);
    }

    const allKeys = new Set([
      ...fromLoanTxns.keys(),
      ...fromObligations.keys(),
      ...entityByMonth.keys(),
    ]);
    const result = new Map<string, LoanCurrencyTotals[]>();
    for (const k of allKeys) {
      const a = fromLoanTxns.get(k) ?? [];
      const b = fromObligations.get(k) ?? [];
      const c = entityByMonth.has(k)
        ? entityTransactionLoanTotals(entityByMonth.get(k)!)
        : [];
      result.set(k, mergeLoanTotals(mergeLoanTotals(a, b), c));
    }
    return result;
  }, [loans, obligations, transactions]);

  // Collect all month keys that appear in either regular transactions or loans
  const allMonthKeys = useMemo(() => {
    const txnKeys = new Set(months.map((m) => m.key));
    const loanKeys = new Set(loansByMonthKey.keys());
    const combined = new Set([...txnKeys, ...loanKeys]);
    return [...combined].sort((a, b) => b.localeCompare(a));
  }, [months, loansByMonthKey]);

  // Month lookup map for quick access
  const monthByKey = useMemo(
    () => new Map<string, MonthGroup>(months.map((m) => [m.key, m])),
    [months],
  );

  // Combined totals for multi-month header
  const combinedSummary = useMemo(
    () => totalsByCurrency(transactions),
    [transactions],
  );
  const combinedLoanSummary = useMemo(() => {
    const fromLoanTxns = loanTotalsByCurrency(loans);
    const fromObls = obligationLoanTotals(obligations);
    const fromEntityTxn = entityTransactionLoanTotals(transactions);
    return mergeLoanTotals(
      mergeLoanTotals(fromLoanTxns, fromObls),
      fromEntityTxn,
    );
  }, [loans, obligations, transactions]);

  const combinedTitle = useMemo(() => {
    if (rangeMode === "3m") return "Last 3 months";
    if (rangeMode === "6m") return "Last 6 months";
    if (rangeMode === "year") return "Last 12 months";
    if (rangeMode === "custom") {
      const fl = from.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
      const tl = to.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
      return `${fl} – ${tl}`;
    }
    return "Combined";
  }, [rangeMode, from, to]);

  const hasData = months.length > 0 || loans.length > 0;

  return (
    <div className="fade-up">
      <h1 className="page-title mb-4">Transactions</h1>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
            style={{ color: "var(--color-mist)" }}
          >
            <SearchIcon />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search transactions"
            className="field w-full"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <button type="submit" className="btn-ghost shrink-0" disabled={!searchQuery.trim()}>
          Search
        </button>
      </form>

      {/* Range selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {rangeOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setRangeMode(opt.id)}
            className={`chip ${rangeMode === opt.id ? "chip-active" : "chip-idle"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Month nav */}
      {rangeMode === "month" && (
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            className="btn-ghost"
          >
            ← Prev
          </button>
          <span
            style={{
              fontSize: "0.88rem",
              fontWeight: 500,
              color: "var(--color-paper)",
            }}
          >
            {viewMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            className="btn-ghost"
          >
            Next →
          </button>
        </div>
      )}

      {/* Custom date range */}
      {rangeMode === "custom" && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="field text-sm"
          />
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="field text-sm"
          />
        </div>
      )}

      {deleteError && (
        <div
          className="mb-3 rounded-xl px-3 py-2 text-sm"
          style={{
            color: "var(--color-red)",
            background: "rgba(255,69,58,0.08)",
            border: "1px solid rgba(255,69,58,0.18)",
          }}
        >
          {deleteError}
        </div>
      )}

      {loading ? (
        <SkeletonLedger />
      ) : !hasData ? (
        <p className="muted text-sm">No transactions in this period.</p>
      ) : (
        <div className="space-y-6">
          {/* Combined summary header for multi-month ranges */}
          {rangeMode !== "month" &&
            (combinedSummary.length > 0 || combinedLoanSummary.length > 0) && (
              <SummaryBoxPair
                label={combinedTitle}
                byCurrency={combinedSummary}
                loanByCurrency={combinedLoanSummary}
                accent
              />
            )}

          {allMonthKeys.map((mKey) => {
            const month = monthByKey.get(mKey);
            const loanByCurrency = loansByMonthKey.get(mKey) ?? [];
            const byCurrency = month?.byCurrency ?? [];

            // Derive label for loan-only months
            const [year, mon] = mKey.split("-").map(Number);
            const monthLabel =
              month?.label ?? formatMonthLabel(new Date(year, mon - 1, 1));

            return (
              <section key={mKey}>
                <SummaryBoxPair
                  label={monthLabel}
                  byCurrency={byCurrency}
                  loanByCurrency={loanByCurrency}
                />

                {month && (
                  <div className="space-y-4">
                    {month.days.map((day) => (
                      <div key={day.key}>
                        <p className="section-label mb-2">{day.label}</p>
                        <div className="space-y-2">
                          {day.transactions.map((t) => (
                            <TransactionItem
                              key={t._id}
                              transaction={t}
                              hideDate
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
