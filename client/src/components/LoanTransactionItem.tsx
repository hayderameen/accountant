import { formatMoney, type LoanTransaction } from "../api/client";
import { FALLBACK_CURRENCY } from "../lib/currencies";

const LOAN_LABELS: Record<LoanTransaction["type"], string> = {
  loan_given: "Loan given",
  loan_received: "Loan received",
  repayment_made: "Loan repayment",
  repayment_received: "Repayment received",
};

const ENTITY_PREFIX: Record<LoanTransaction["type"], string> = {
  loan_given: "Lent to",
  repayment_received: "Repayment from",
  loan_received: "Borrowed from",
  repayment_made: "Repaid to",
};

function entityDetails(loan: LoanTransaction): { prefix: string; name: string } | null {
  if (!loan.entityId || typeof loan.entityId !== "object") return null;
  return { prefix: ENTITY_PREFIX[loan.type], name: loan.entityId.name };
}

export function loanTransactionTitle(loan: LoanTransaction): string {
  return LOAN_LABELS[loan.type];
}

export function loanTransactionSubtitle(
  loan: LoanTransaction,
  opts?: { hideDate?: boolean },
): string {
  const parts: string[] = [];
  const d = new Date(loan.date);
  if (!opts?.hideDate) {
    parts.push(d.toLocaleDateString());
  }
  parts.push(
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  );
  return parts.join(" · ");
}

function signedLoanAmount(loan: LoanTransaction): {
  text: string;
  className: string;
} {
  const currency = loan.currency || FALLBACK_CURRENCY;
  const value = formatMoney(loan.amount, currency);
  if (loan.type === "repayment_received" || loan.type === "loan_received") {
    return { text: `+${value}`, className: "amount-in" };
  }
  return { text: `−${value}`, className: "amount-out" };
}

function DetailLine({
  label,
  value,
  valueColor = "var(--color-paper)",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <p className="mt-1 flex min-w-0 items-baseline gap-1.5">
      <span
        className="shrink-0"
        style={{
          fontSize: "0.68rem",
          fontWeight: 650,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--color-mist)",
        }}
      >
        {label}
      </span>
      <span
        className="truncate"
        style={{
          fontSize: "0.84rem",
          fontWeight: 560,
          color: valueColor,
        }}
      >
        {value}
      </span>
    </p>
  );
}

interface LoanTransactionItemProps {
  loan: LoanTransaction;
  hideDate?: boolean;
}

export function LoanTransactionItem({
  loan,
  hideDate,
}: LoanTransactionItemProps) {
  const subtitle = loanTransactionSubtitle(loan, { hideDate });
  const entity = entityDetails(loan);
  const memo = loan.memo?.trim();
  const amount = signedLoanAmount(loan);
  const loanDate = new Date(loan.date);
  const dayShort = loanDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayFull = loanDate.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div
      className="list-row items-center"
      style={{
        borderColor: "rgba(100,210,255,0.18)",
        background: "rgba(100,210,255,0.045)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className="truncate"
            style={{ fontWeight: 500, color: "var(--color-paper)" }}
          >
            {loanTransactionTitle(loan)}
          </p>
          <span
            title={dayFull}
            style={{
              flexShrink: 0,
              fontSize: "0.58rem",
              fontWeight: 650,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--color-paper-muted)",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 5,
              padding: "1px 5px",
            }}
          >
            {dayShort}
          </span>
          <span
            style={{
              flexShrink: 0,
              fontSize: "0.62rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-blue)",
              background: "rgba(100,210,255,0.12)",
              border: "1px solid rgba(100,210,255,0.22)",
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            loan
          </span>
        </div>

        {entity && (
          <DetailLine
            label={entity.prefix}
            value={entity.name}
            valueColor="var(--color-sage-bright)"
          />
        )}
        {memo && <DetailLine label="Memo" value={memo} />}

        {subtitle && (
          <p
            className="mt-1 truncate"
            style={{ fontSize: "0.76rem", color: "var(--color-mist)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <p
        className={`shrink-0 tabular-nums ${amount.className}`}
        style={{ fontSize: "0.93rem", fontWeight: 600 }}
      >
        {amount.text}
      </p>
    </div>
  );
}
