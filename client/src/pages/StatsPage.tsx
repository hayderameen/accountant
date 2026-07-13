import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  api,
  type StatsGroupBy,
  type StatsResponse,
} from "../api/client";
import { PeriodSelector } from "../components/PeriodSelector";
import { SkeletonStatsCharts } from "../components/Skeleton";
import {
  IncomeExpenseCurrencyStats,
  LoanCurrencyStats,
  PeriodComparisonCharts,
} from "../components/stats/StatsCharts";
import {
  getRange,
  monthRange,
  monthValue,
  shiftMonth,
  type RangeMode,
} from "../lib/dateRange";
import { startOfMonth } from "../lib/groupTransactions";

type StatsTab = "incomeExpense" | "loans";
type ViewMode = "range" | "compare";

export function StatsPage() {
  const now = new Date();
  const [tab, setTab] = useState<StatsTab>("incomeExpense");
  const [viewMode, setViewMode] = useState<ViewMode>("range");
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(now));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [groupBy, setGroupBy] = useState<StatsGroupBy>("day");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [comparison, setComparison] = useState<
    Array<{ label: string; data: StatsResponse }>
  >([]);
  const [compareMonth, setCompareMonth] = useState(monthValue(now));
  const [selectedMonths, setSelectedMonths] = useState<string[]>([
    monthValue(shiftMonth(now, -1)),
    monthValue(now),
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(
    () => getRange(rangeMode, viewMonth, customFrom, customTo),
    [rangeMode, viewMonth, customFrom, customTo],
  );
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const rangeFrom = range.from.toISOString();
  const rangeTo = range.to.toISOString();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const request = (from: string, to: string) =>
      api.getStats({
        from,
        to,
        groupBy,
        timezone,
      });

    if (viewMode === "compare") {
      Promise.all(
        selectedMonths.map(async (value) => {
          const period = monthRange(value);
          return {
            label: period.label,
            data: await request(period.from.toISOString(), period.to.toISOString()),
          };
        }),
      )
        .then((rows) => {
          if (!cancelled) setComparison(rows);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load stats");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      request(rangeFrom, rangeTo)
        .then((result) => {
          if (!cancelled) setStats(result);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load stats");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    viewMode,
    rangeFrom,
    rangeTo,
    groupBy,
    timezone,
    selectedMonths,
  ]);

  const addComparisonMonth = (event: FormEvent) => {
    event.preventDefault();
    if (!compareMonth || selectedMonths.includes(compareMonth)) return;
    setSelectedMonths((current) => [...current, compareMonth].sort());
  };

  const rows =
    tab === "incomeExpense" ? stats?.incomeExpense ?? [] : stats?.loans ?? [];
  const comparisonHasData = comparison.some((period) =>
    tab === "incomeExpense"
      ? period.data.incomeExpense.length > 0
      : period.data.loans.length > 0,
  );

  return (
    <div className="fade-up">
      <div className="mb-5">
        <p className="section-label mb-1.5">Analysis</p>
        <h1 className="page-title">Stats</h1>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("incomeExpense")}
          className={`chip ${tab === "incomeExpense" ? "chip-active" : "chip-idle"}`}
        >
          Income & Expenses
        </button>
        <button
          type="button"
          onClick={() => setTab("loans")}
          className={`chip ${tab === "loans" ? "chip-active" : "chip-idle"}`}
        >
          Loans
        </button>
      </div>

      <div className="panel mb-5 space-y-4 p-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("range")}
            className={`chip flex-1 ${viewMode === "range" ? "chip-active" : "chip-idle"}`}
          >
            Date range
          </button>
          <button
            type="button"
            onClick={() => setViewMode("compare")}
            className={`chip flex-1 ${viewMode === "compare" ? "chip-active" : "chip-idle"}`}
          >
            Compare periods
          </button>
        </div>

        {viewMode === "range" ? (
          <PeriodSelector
            rangeMode={rangeMode}
            onRangeModeChange={setRangeMode}
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
          />
        ) : (
          <div className="space-y-3">
            <form onSubmit={addComparisonMonth} className="flex gap-2">
              <input
                type="month"
                value={compareMonth}
                onChange={(event) => setCompareMonth(event.target.value)}
                className="field flex-1 text-sm"
              />
              <button
                type="submit"
                className="btn-ghost shrink-0"
                disabled={!compareMonth || selectedMonths.includes(compareMonth)}
              >
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {selectedMonths.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setSelectedMonths((current) =>
                      current.length > 1
                        ? current.filter((month) => month !== value)
                        : current,
                    )
                  }
                  className="chip chip-active"
                  title="Remove period"
                >
                  {monthRange(value).label} ×
                </button>
              ))}
            </div>
            <div>
              <p className="section-label mb-2">Compare by</p>
              <div className="flex gap-2">
                {(["day", "week", "month"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGroupBy(value)}
                    className={`chip capitalize ${
                      groupBy === value ? "chip-active" : "chip-idle"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonStatsCharts />
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
      ) : viewMode === "compare" ? (
        comparisonHasData ? (
          <PeriodComparisonCharts periods={comparison} tab={tab} groupBy={groupBy} />
        ) : (
          <div className="panel p-4">
            <p className="muted text-sm">No activity in these periods.</p>
          </div>
        )
      ) : rows.length === 0 ? (
        <div className="panel p-4">
          <p className="muted text-sm">No activity in this period.</p>
        </div>
      ) : (
        <div className="space-y-9">
          {tab === "incomeExpense"
            ? (stats?.incomeExpense ?? []).map((row) => (
                <IncomeExpenseCurrencyStats key={row.currency} data={row} />
              ))
            : (stats?.loans ?? []).map((row) => (
                <LoanCurrencyStats key={row.currency} data={row} />
              ))}
        </div>
      )}
    </div>
  );
}
