import { useEffect, useMemo, useState } from "react";
import { api, formatMoney, type Transaction } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { TransactionItem } from "../components/TransactionItem";
import {
  endOfMonth,
  groupByMonthAndDay,
  startOfMonth,
  toApiDate,
  type MonthGroup,
} from "../lib/groupTransactions";

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

function PeriodSummary({
  title,
  income,
  expense,
  currency,
  prominent,
}: {
  title: string;
  income: number;
  expense: number;
  currency: string;
  prominent?: boolean;
}) {
  const net = income - expense;
  return (
    <div
      className={`mb-3 rounded-lg border px-3 py-2.5 ${
        prominent
          ? "border-emerald-900/50 bg-emerald-950/30"
          : "border-zinc-800 bg-zinc-900/80"
      }`}
    >
      <p className={`mb-2 text-sm font-semibold ${prominent ? "text-emerald-200" : "text-zinc-200"}`}>
        {title}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-emerald-400">Income +{formatMoney(income, currency)}</span>
        <span className="text-rose-400">Expense -{formatMoney(expense, currency)}</span>
        <span className={net >= 0 ? "text-emerald-300" : "text-rose-300"}>
          Net {net >= 0 ? "+" : "-"}
          {formatMoney(Math.abs(net), currency)}
        </span>
      </div>
    </div>
  );
}

function MonthSummary({
  month,
  currency,
}: {
  month: MonthGroup;
  currency: string;
}) {
  return (
    <PeriodSummary
      title={month.label}
      income={month.income}
      expense={month.expense}
      currency={currency}
    />
  );
}

export function TransactionsPage() {
  const { user } = useAuth();
  const currency = user?.settings?.defaultCurrency ?? "USD";
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  const months = useMemo(
    () => groupByMonthAndDay(transactions),
    [transactions],
  );

  const combinedSummary = useMemo(() => {
    const income = months.reduce((sum, m) => sum + m.income, 0);
    const expense = months.reduce((sum, m) => sum + m.expense, 0);
    return { income, expense };
  }, [months]);

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
    <div>
      <h1 className="mb-4 text-lg font-semibold">Transactions</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {rangeOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setRangeMode(opt.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              rangeMode === opt.id
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400"
            }`}
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
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ← Prev
          </button>
          <span className="text-sm font-medium text-zinc-200">
            {viewMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
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
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : months.length === 0 ? (
        <p className="text-sm text-zinc-500">No transactions in this period.</p>
      ) : (
        <div className="space-y-6">
          {rangeMode !== "month" && (
            <PeriodSummary
              title={combinedTitle}
              income={combinedSummary.income}
              expense={combinedSummary.expense}
              currency={currency}
              prominent
            />
          )}

          {months.map((month) => (
            <section key={month.key}>
              <MonthSummary month={month} currency={currency} />

              <div className="space-y-4">
                {month.days.map((day) => (
                  <div key={day.key}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {day.label}
                    </p>
                    <div className="space-y-2">
                      {day.transactions.map((t) => (
                        <TransactionItem
                          key={t._id}
                          transaction={t}
                          currency={currency}
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
      )}
    </div>
  );
}
