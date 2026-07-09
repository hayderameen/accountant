import { formatMoney } from "../api/client";
import type { CurrencyAmount } from "../lib/loanTotals";

interface LoanCurrencySummaryProps {
  title: string;
  totals: CurrencyAmount[];
  variant: "owed" | "owedToYou";
}

export function LoanCurrencySummary({ title, totals, variant }: LoanCurrencySummaryProps) {
  if (totals.length === 0) return null;
  const color = variant === "owed" ? "var(--color-red)" : "var(--color-green)";

  return (
    <div className="panel mb-3 px-4 py-3.5">
      <p className="section-label mb-3">{title}</p>
      <div className="space-y-2.5">
        {totals.map(({ currency, amount }) => (
          <div key={currency} className="flex items-baseline justify-between gap-3">
            <span
              style={{
                fontSize: "0.73rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-mist)",
              }}
            >
              {currency}
            </span>
            <span
              className="tabular-nums"
              style={{ fontSize: "1.05rem", fontWeight: 700, color }}
            >
              {formatMoney(amount, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
