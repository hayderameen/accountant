import { formatMoney, type CurrencyBalance } from "../api/client";

interface EntityBalanceLinesProps {
  balances: CurrencyBalance[];
  variant: "owed" | "owedToYou";
}

export function EntityBalanceLines({ balances, variant }: EntityBalanceLinesProps) {
  const color = variant === "owed" ? "var(--color-red)" : "var(--color-green)";

  if (balances.length === 0) {
    return <span style={{ fontSize: "0.85rem", color: "var(--color-mist)" }}>—</span>;
  }

  return (
    <div className="space-y-0.5 text-right">
      {balances.map((b) => (
        <p
          key={b.currency}
          className="tabular-nums"
          style={{ fontSize: "0.88rem", fontWeight: 600, color }}
        >
          {formatMoney(b.balance, b.currency)}
        </p>
      ))}
    </div>
  );
}
