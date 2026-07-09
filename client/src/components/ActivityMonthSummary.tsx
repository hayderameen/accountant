import { formatMoney } from "../api/client";
import type { ActivityCurrencyTotals } from "../lib/groupActivity";

export function ActivityMonthSummary({
  title,
  byCurrency,
}: {
  title: string;
  byCurrency: ActivityCurrencyTotals[];
}) {
  if (byCurrency.length === 0) return null;

  return (
    <div className="panel mb-3 px-4 py-3.5">
      <p
        className="mb-3"
        style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--color-paper)" }}
      >
        {title}
      </p>
      <div className="space-y-2.5">
        {byCurrency.map(({ currency, added, paid }) => (
          <div key={currency}>
            <p
              style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--color-mist)",
                marginBottom: "0.25rem",
              }}
            >
              {currency}
            </p>
            <div className="flex flex-wrap gap-x-5 tabular-nums" style={{ fontSize: "0.88rem" }}>
              <span className="amount-out" style={{ fontWeight: 600 }}>
                +{formatMoney(added, currency)}
              </span>
              <span className="amount-in" style={{ fontWeight: 600 }}>
                −{formatMoney(paid, currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
