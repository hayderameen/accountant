import { useEffect, useMemo, useState } from "react";
import { api, formatMoney, type Transaction } from "../api/client";
import {
  endOfMonth,
  groupByMonthAndDay,
  startOfMonth,
  toApiDate,
  type MonthGroup,
} from "../lib/groupTransactions";
import { totalsByCurrency, type CurrencyTotals } from "../lib/currencyTotals";
import { TransactionItem } from "../components/TransactionItem";

type RangeMode = "month" | "3m" | "6m" | "year" | "custom";

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

function CurrencyRow({
  currency,
  income,
  expense,
}: {
  currency: string;
  income: number;
  expense: number;
}) {
  const net = income - expense;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span className="section-label w-full">{currency}</span>
      <span className="amount-in">Income +{formatMoney(income, currency)}</span>
      <span className="amount-out">Expense -{formatMoney(expense, currency)}</span>
      <span className={net >= 0 ? "amount-in" : "amount-out"}>
        Net {net >= 0 ? "+" : "-"}
        {formatMoney(Math.abs(net), currency)}
      </span>
    </div>
  );
}

function PeriodSummary({
  title,
  byCurrency,
  prominent,
}: {
  title: string;
  byCurrency: CurrencyTotals[];
  prominent?: boolean;
}) {
  return (
    <div
      className={`mb-3 px-3 py-2.5 ${prominent ? "panel-accent" : "panel"}`}
    >
      <p className={`mb-2 ${prominent ? "section-label text-[var(--color-sage-bright)]" : "font-display text-sm font-semibold text-[var(--color-paper)]"}`}>
        {title}
      </p>
      <div className="space-y-2">
        {byCurrency.map((row) => (
          <CurrencyRow key={row.currency} {...row} />
        ))}
      </div>
    </div>
  );
}

function MonthSummary({ month }: { month: MonthGroup }) {
  return <PeriodSummary title={month.label} byCurrency={month.byCurrency} />;
}

export function TransactionsPage() {
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState("");

  const { from, to } = useMemo(
    () => getRange(rangeMode, viewMonth, customFrom, customTo),
    [rangeMode, viewMonth, customFrom, customTo],
  );

  useEffect(() => {
    setLoading(true);
    api
      .getTransactions({ from: toApiDate(from), to: toApiDate(to) })
      .then(setTransactions)
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

  const months = useMemo(
    () => groupByMonthAndDay(transactions),
    [transactions],
  );

  const combinedSummary = useMemo(
    () => totalsByCurrency(transactions),
    [transactions],
  );

  const combinedTitle = useMemo(() => {
    if (rangeMode === "3m") return "Last 3 months";
    if (rangeMode === "6m") return "Last 6 months";
    if (rangeMode === "year") return "Last 12 months";
    if (rangeMode === "custom") {
      const fromLabel = from.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const toLabel = to.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      return `${fromLabel} – ${toLabel}`;
    }
    return "Combined";
  }, [rangeMode, from, to]);

  const rangeOptions: { id: RangeMode; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "3m", label: "3 mo" },
    { id: "6m", label: "6 mo" },
    { id: "year", label: "Year" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div className="fade-up">
      <h1 className="page-title mb-4">Transactions</h1>

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

      {rangeMode === "month" && (
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            className="btn-ghost"
          >
            ← Prev
          </button>
          <span className="text-sm font-medium text-[var(--color-paper)]">
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
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
          {deleteError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-mist)]">Loading...</p>
      ) : months.length === 0 ? (
        <p className="text-sm text-[var(--color-mist)]">No transactions in this period.</p>
      ) : (
        <div className="space-y-6">
          {rangeMode !== "month" && combinedSummary.length > 0 && (
            <PeriodSummary
              title={combinedTitle}
              byCurrency={combinedSummary}
              prominent
            />
          )}

          {months.map((month) => (
            <section key={month.key}>
              <MonthSummary month={month} />

              <div className="space-y-4">
                {month.days.map((day) => (
                  <div key={day.key}>
                    <p className="section-label mb-2">
                      {day.label}
                    </p>
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
