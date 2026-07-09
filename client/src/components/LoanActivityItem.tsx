import { formatMoney, type EntityActivityItem } from "../api/client";

export function LoanActivityItem({ item }: { item: EntityActivityItem }) {
  const sign  = item.type === "add" ? "+" : "−";
  const color = item.type === "add" ? "var(--color-red)" : "var(--color-green)";
  const title    = item.memo?.trim() || item.label;
  const subtitle = item.memo?.trim() ? item.label : undefined;

  return (
    <div className="list-row items-center">
      <div className="min-w-0 flex-1">
        <p style={{ fontWeight: 500, color: "var(--color-paper)" }} className="truncate">
          {title}
        </p>
        {subtitle && (
          <p
            className="mt-0.5 truncate"
            style={{ fontSize: "0.78rem", color: "var(--color-mist)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <p
        className="shrink-0 tabular-nums"
        style={{ fontSize: "0.93rem", fontWeight: 600, color }}
      >
        {sign}{formatMoney(item.amount, item.currency)}
      </p>
    </div>
  );
}
