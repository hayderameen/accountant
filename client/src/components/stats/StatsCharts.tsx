import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatMoney,
  type StatsCategoryTotal,
  type StatsGroupBy,
  type StatsResponse,
} from "../../api/client";

const COLORS = [
  "#0a84ff",
  "#30d158",
  "#ff9f0a",
  "#ff453a",
  "#64d2ff",
  "#bf5af2",
  "#ffd60a",
  "#5e5ce6",
];

const tooltipStyle = {
  background: "rgba(28,28,30,0.94)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
};

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-3">
      <div className="mb-3">
        <p className="section-label">{title}</p>
        {subtitle && <p className="muted mt-1 text-xs">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function MetricGrid({
  metrics,
  currency,
}: {
  metrics: Array<{ label: string; value: number; color: string }>;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl px-3 py-2.5"
          style={{
            background: `color-mix(in srgb, ${metric.color} 9%, transparent)`,
            border: `1px solid color-mix(in srgb, ${metric.color} 20%, transparent)`,
          }}
        >
          <p
            className="mb-1 text-[0.62rem] font-semibold tracking-[0.07em] uppercase"
            style={{ color: metric.color }}
          >
            {metric.label}
          </p>
          <p className="tabular-nums text-sm font-semibold" style={{ color: metric.color }}>
            {formatMoney(metric.value, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function BreakdownPie({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: StatsCategoryTotal[];
  currency: string;
}) {
  const data = rows.filter((row) => row.amount > 0);
  return (
    <ChartPanel title={title}>
      {data.length === 0 ? (
        <p className="muted py-8 text-center text-sm">No data for this period.</p>
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="categoryName"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="transparent"
                >
                  {data.map((row, index) => (
                    <Cell key={`${row.categoryName}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatMoney(Number(value), currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.map((row, index) => (
              <div key={`${row.categoryName}-${index}`} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: COLORS[index % COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-paper-muted">
                  {row.categoryName}
                </span>
                <span className="tabular-nums text-sm text-paper">
                  {formatMoney(row.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartPanel>
  );
}

function DeltaText({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  if (previous <= 0) return null;
  const delta = current - previous;
  const percent = Math.abs((delta / previous) * 100);
  const favorable = inverse ? delta <= 0 : delta >= 0;
  return (
    <span
      className="text-xs font-medium"
      style={{ color: favorable ? "var(--color-green)" : "var(--color-red)" }}
    >
      {delta >= 0 ? "↑" : "↓"} {percent.toFixed(1)}% vs previous
    </span>
  );
}

export function IncomeExpenseCurrencyStats({
  data,
}: {
  data: StatsResponse["incomeExpense"][number];
}) {
  const previous = data.series.at(-2);
  const current = data.series.at(-1);
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Currency</p>
          <h2 className="text-xl font-semibold text-paper">{data.currency}</h2>
        </div>
        {current && previous && (
          <DeltaText current={current.expense} previous={previous.expense} inverse />
        )}
      </div>

      <MetricGrid
        currency={data.currency}
        metrics={[
          { label: "Income", value: data.income, color: "var(--color-green)" },
          { label: "Expenses", value: data.expense, color: "var(--color-red)" },
          {
            label: "Net",
            value: Math.abs(data.net),
            color: data.net >= 0 ? "var(--color-blue)" : "var(--color-red)",
          },
        ]}
      />

      <ChartPanel title="Income vs expenses" subtitle="Activity over the selected period">
        {data.series.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No activity.</p>
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(235,235,245,0.45)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(235,235,245,0.35)", fontSize: 9 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatMoney(Number(value), data.currency),
                    String(name),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Income" fill="#30d158" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#ff453a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartPanel>

      <BreakdownPie
        title="Where money was spent"
        rows={data.expenseCategories}
        currency={data.currency}
      />
      <BreakdownPie
        title="Where income came from"
        rows={data.incomeCategories}
        currency={data.currency}
      />
    </section>
  );
}

export function LoanCurrencyStats({
  data,
}: {
  data: StatsResponse["loans"][number];
}) {
  const pieData = [
    { name: "Taken", amount: data.taken, color: "#ff9f0a" },
    { name: "Given", amount: data.given, color: "#64d2ff" },
    { name: "Paid back", amount: data.repaymentsMade, color: "#ff453a" },
    { name: "Repaid to me", amount: data.repaymentsReceived, color: "#30d158" },
  ].filter((row) => row.amount > 0);
  const previous = data.series.at(-2);
  const current = data.series.at(-1);
  const totalAt = (point: typeof current) =>
    point
      ? point.taken + point.given + point.repaymentsMade + point.repaymentsReceived
      : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Currency</p>
          <h2 className="text-xl font-semibold text-paper">{data.currency}</h2>
        </div>
        {current && previous && (
          <DeltaText current={totalAt(current)} previous={totalAt(previous)} />
        )}
      </div>

      <MetricGrid
        currency={data.currency}
        metrics={[
          { label: "Taken", value: data.taken, color: "#ff9f0a" },
          { label: "Given", value: data.given, color: "var(--color-blue)" },
          { label: "Paid back", value: data.repaymentsMade, color: "var(--color-red)" },
          {
            label: "Repaid to me",
            value: data.repaymentsReceived,
            color: "var(--color-green)",
          },
        ]}
      />

      <ChartPanel title="Loan activity split">
        {pieData.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No loan activity.</p>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {pieData.map((row) => <Cell key={row.name} fill={row.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatMoney(Number(value), data.currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map((row) => (
                <div key={row.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                  <span className="flex-1 text-sm text-paper-muted">{row.name}</span>
                  <span className="tabular-nums text-sm text-paper">
                    {formatMoney(row.amount, data.currency)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </ChartPanel>

      <ChartPanel title="Loan trend" subtitle="Taken, given, and repayments over time">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(235,235,245,0.45)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(235,235,245,0.35)", fontSize: 9 }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  formatMoney(Number(value), data.currency),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line dataKey="taken" name="Taken" stroke="#ff9f0a" strokeWidth={2} dot={false} />
              <Line dataKey="given" name="Given" stroke="#64d2ff" strokeWidth={2} dot={false} />
              <Line
                dataKey="repaymentsMade"
                name="Paid back"
                stroke="#ff453a"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="repaymentsReceived"
                name="Repaid to me"
                stroke="#30d158"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title="By person or entity">
        {data.byEntity.length === 0 ? (
          <p className="muted text-sm">No entity activity.</p>
        ) : (
          <div className="space-y-3">
            {data.byEntity.map((entity) => {
              const primary =
                entity.direction === "i_owe" ? entity.taken : entity.given;
              const repayment =
                entity.direction === "i_owe"
                  ? entity.repaymentsMade
                  : entity.repaymentsReceived;
              return (
                <div key={entity.entityId}>
                  <p className="mb-1 truncate text-sm font-medium text-paper">
                    {entity.entityName}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <p style={{ color: entity.direction === "i_owe" ? "#ff9f0a" : "#64d2ff" }}>
                      {entity.direction === "i_owe" ? "Taken" : "Given"}{" "}
                      <span className="tabular-nums">
                        {formatMoney(primary, data.currency)}
                      </span>
                    </p>
                    <p
                      style={{
                        color:
                          entity.direction === "i_owe"
                            ? "var(--color-red)"
                            : "var(--color-green)",
                      }}
                    >
                      {entity.direction === "i_owe" ? "Paid back" : "Repaid"}{" "}
                      <span className="tabular-nums">
                        {formatMoney(repayment, data.currency)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartPanel>
    </section>
  );
}

function comparisonIndex(bucket: string, index: number, groupBy: StatsGroupBy) {
  if (groupBy === "day") return String(Number(bucket.slice(-2)));
  if (groupBy === "week") return String(index + 1);
  return "Total";
}

export function PeriodComparisonCharts({
  periods,
  tab,
  groupBy,
}: {
  periods: Array<{ label: string; data: StatsResponse }>;
  tab: "incomeExpense" | "loans";
  groupBy: StatsGroupBy;
}) {
  const currencies = [
    ...new Set(
      periods.flatMap((period) =>
        (tab === "incomeExpense" ? period.data.incomeExpense : period.data.loans).map(
          (row) => row.currency,
        ),
      ),
    ),
  ].sort();

  return (
    <div className="space-y-8">
      {currencies.map((currency) => {
        const points = new Map<string, Record<string, string | number>>();
        const totals = periods.map((period, periodIndex) => {
          const row = (tab === "incomeExpense"
            ? period.data.incomeExpense
            : period.data.loans
          ).find((item) => item.currency === currency);
          const series = row?.series ?? [];
          series.forEach((point, pointIndex) => {
            const x = comparisonIndex(point.bucket, pointIndex, groupBy);
            const target = points.get(x) ?? { x };
            target[period.label] =
              tab === "incomeExpense"
                ? "expense" in point ? point.expense : 0
                : "taken" in point
                  ? point.taken + point.given + point.repaymentsMade + point.repaymentsReceived
                  : 0;
            points.set(x, target);
          });
          const total =
            tab === "incomeExpense"
              ? row && "expense" in row ? row.expense : 0
              : row && "taken" in row
                ? row.taken + row.given + row.repaymentsMade + row.repaymentsReceived
                : 0;
          return { label: period.label, total, periodIndex };
        });
        const chartData = [...points.values()].sort(
          (a, b) => Number(a.x) - Number(b.x),
        );

        return (
          <section key={currency} className="space-y-3">
            <h2 className="text-xl font-semibold text-paper">{currency}</h2>
            <ChartPanel
              title={tab === "incomeExpense" ? "Expense comparison" : "Loan activity comparison"}
              subtitle={`Compared by ${groupBy}`}
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="x" tick={{ fill: "rgba(235,235,245,0.45)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(235,235,245,0.35)", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        formatMoney(Number(value), currency),
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {periods.map((period, index) => (
                      <Line
                        key={period.label}
                        dataKey={period.label}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
            <div className="panel space-y-3 p-3">
              {totals.map((total, index) => (
                <div key={total.label} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-paper">{total.label}</p>
                    {index > 0 && (
                      <DeltaText
                        current={total.total}
                        previous={totals[index - 1].total}
                        inverse={tab === "incomeExpense"}
                      />
                    )}
                  </div>
                  <span className="tabular-nums text-sm text-paper">
                    {formatMoney(total.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
