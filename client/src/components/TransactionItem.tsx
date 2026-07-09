import { formatMoney, type Transaction, type Category } from "../api/client";
import { FALLBACK_CURRENCY } from "../lib/currencies";
import { transactionCurrency } from "../lib/currencyTotals";

function categoryName(categoryId?: Category | string): string | undefined {
  if (categoryId && typeof categoryId === "object") return categoryId.name;
  return undefined;
}

export function transactionTitle(t: Transaction): string {
  if (t.memo?.trim()) return t.memo.trim();
  const cat = categoryName(t.categoryId);
  if (cat) return cat;
  return t.type.charAt(0).toUpperCase() + t.type.slice(1);
}

export function transactionSubtitle(
  t: Transaction,
  opts?: { hideDate?: boolean },
): string {
  const parts: string[] = [];
  if (!opts?.hideDate) parts.push(new Date(t.date).toLocaleDateString());
  const cat = categoryName(t.categoryId);
  if (cat) parts.push(cat);
  if (typeof t.accountId === "object" && t.accountId?.name)
    parts.push(t.accountId.name);
  return parts.join(" · ");
}

const amountClass = {
  income:   "amount-in",
  expense:  "amount-out",
  transfer: "amount-transfer",
} as const;

export function signedAmount(t: Transaction, fallbackCurrency = FALLBACK_CURRENCY): string {
  const currency = transactionCurrency(t, fallbackCurrency);
  const value = formatMoney(t.amount, currency);
  if (t.type === "income") return `+${value}`;
  if (t.type === "expense") return `-${value}`;
  return value;
}

interface TransactionItemProps {
  transaction: Transaction;
  fallbackCurrency?: string;
  hideDate?: boolean;
  onDelete?: (id: string) => void;
}

export function TransactionItem({
  transaction: t,
  fallbackCurrency = FALLBACK_CURRENCY,
  hideDate,
  onDelete,
}: TransactionItemProps) {
  const subtitle = transactionSubtitle(t, { hideDate });

  return (
    <div className="list-row items-center">
      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{ fontWeight: 500, color: "var(--color-paper)" }}
        >
          {transactionTitle(t)}
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
      <div className="flex shrink-0 items-center gap-2">
        <p
          className={`tabular-nums ${amountClass[t.type]}`}
          style={{ fontSize: "0.93rem", fontWeight: 600 }}
        >
          {signedAmount(t, fallbackCurrency)}
        </p>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(t._id)}
            aria-label="Delete transaction"
            style={{
              padding: "2px 6px",
              borderRadius: 5,
              fontSize: "0.72rem",
              color: "var(--color-mist)",
              transition: "color 140ms ease, background 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-red)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-mist)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
