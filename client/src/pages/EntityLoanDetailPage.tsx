import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  formatMoney,
  type Account,
  type CurrencyBalance,
  type Entity,
  type EntityActivityItem,
} from "../api/client";
import { ActivityMonthSummary } from "../components/ActivityMonthSummary";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanActivityItem } from "../components/LoanActivityItem";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import { groupActivityByMonthAndDay } from "../lib/groupActivity";
import { owedCurrenciesFromBalances } from "../lib/loanTotals";

function balanceInCurrency(balances: CurrencyBalance[], currency: string): number {
  return balances.find((b) => b.currency === currency)?.balance ?? 0;
}

export function EntityLoanDetailPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [activity, setActivity] = useState<EntityActivityItem[]>([]);
  const [balances, setBalances] = useState<CurrencyBalance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"add" | "repay">("repay");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!entityId) return;
    setLoading(true);
    api
      .getEntityActivity(entityId)
      .then((data) => {
        setEntity(data.entity);
        setActivity(data.activity);
        const rows = data.summary.byCurrency.map((row) => {
          if ("balance" in row) {
            return { currency: row.currency, balance: row.balance };
          }
          return { currency: row.currency, balance: row.remaining };
        });
        setBalances(rows);
        setCurrency(data.entity.currency ?? defaultCurrency);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [entityId]);

  useEffect(() => {
    api.getAccounts().then((list) => {
      setAccounts(list);
      if (list[0]) setAccountId(list[0]._id);
    });
  }, []);

  const months = useMemo(() => groupActivityByMonthAndDay(activity), [activity]);

  const activityTotals = useMemo(() => {
    const map = new Map<string, { added: number; paid: number }>();
    for (const item of activity) {
      if (!map.has(item.currency)) map.set(item.currency, { added: 0, paid: 0 });
      const bucket = map.get(item.currency)!;
      if (item.type === "add") bucket.added += item.amount;
      else bucket.paid += item.amount;
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [activity]);

  const repayCurrencies = useMemo(
    () => owedCurrenciesFromBalances(balances),
    [balances],
  );
  const currencyOptions = action === "repay" ? repayCurrencies : CURRENCIES;

  useEffect(() => {
    if (action !== "repay") return;
    if (repayCurrencies.length > 0 && !repayCurrencies.includes(currency)) {
      setCurrency(repayCurrencies[0]);
    }
  }, [action, repayCurrencies, currency]);

  const owedInCurrency = balanceInCurrency(balances, currency);
  const maxRepayCents = action === "repay" ? owedInCurrency : undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!entityId || !entity) return;
    setError("");

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (action === "repay") {
      if (!accountId) {
        setError("Select an account");
        return;
      }
      if (amountCents > owedInCurrency) {
        setError(`Cannot pay more than ${formatMoney(owedInCurrency, currency)}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (entity.direction === "they_owe_me") {
        if (action === "add") {
          await api.createLoanTransaction({
            entityId,
            type: "loan_given",
            amount: amountCents,
            currency,
            accountId: accountId || undefined,
            memo: memo || undefined,
          });
        } else {
          await api.createLoanTransaction({
            entityId,
            type: "repayment_received",
            amount: amountCents,
            currency,
            accountId,
            memo: memo || undefined,
          });
        }
      } else if (action === "add") {
        await api.createManualObligation(entityId, amountCents, currency);
      } else {
        await api.createTransaction({
          type: "expense",
          amount: amountCents,
          date: new Date().toISOString(),
          accountId,
          entityId,
          currency,
          memo: memo || undefined,
        });
      }
      setAmount("");
      setMemo("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!entity) return <p className="text-sm text-zinc-500">Not found.</p>;

  const isPending = entity.direction === "i_owe";

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/loans")}
        className="mb-4 text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← Back to loans
      </button>

      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">{entity.name}</h1>
        <div className="text-right">
          <p className="mb-1 text-xs text-zinc-500">
            {isPending ? "Remaining" : "Owed to you"}
          </p>
          <EntityBalanceLines
            balances={balances}
            variant={isPending ? "owed" : "owedToYou"}
          />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
      >
        <p className="text-sm font-medium text-zinc-300">Record activity</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAction("repay")}
            className={`rounded-lg py-2 text-sm ${
              action === "repay" ? "bg-emerald-600" : "bg-zinc-800"
            }`}
          >
            {isPending ? "Pay back" : "Repayment"}
          </button>
          <button
            type="button"
            onClick={() => setAction("add")}
            className={`rounded-lg py-2 text-sm ${
              action === "add" ? "bg-emerald-600" : "bg-zinc-800"
            }`}
          >
            {isPending ? "Add owed" : "Add loan"}
          </button>
        </div>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {currencyOptions.length === 0 ? (
            <option value="">No amounts owed</option>
          ) : (
            currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))
          )}
        </select>
        {(action === "repay" || (action === "add" && accounts.length > 0)) && (
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            required={action === "repay"}
          >
            <option value="">
              {action === "repay" ? "Account" : "Account (optional)"}
            </option>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={maxRepayCents ? maxRepayCents / 100 : undefined}
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          required
        />
        {maxRepayCents !== undefined && maxRepayCents > 0 && (
          <p className="text-xs text-zinc-500">
            Max {formatMoney(maxRepayCents, currency)}
          </p>
        )}
        <input
          type="text"
          placeholder="Memo (optional)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </form>

      {activityTotals.length > 0 && (
        <div className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2.5">
          <p className="mb-2 text-sm font-semibold text-emerald-200">All time</p>
          <div className="space-y-2">
            {activityTotals.map(([c, { added, paid }]) => (
              <div key={c}>
                <p className="text-xs font-medium text-zinc-500">{c}</p>
                <div className="flex flex-wrap gap-x-4 text-sm">
                  <span className="text-rose-400">+{formatMoney(added, c)}</span>
                  <span className="text-emerald-400">-{formatMoney(paid, c)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {months.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="space-y-6">
          {months.map((month) => (
            <section key={month.key}>
              <ActivityMonthSummary title={month.label} byCurrency={month.byCurrency} />
              <div className="space-y-4">
                {month.days.map((day) => (
                  <div key={day.key}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {day.label}
                    </p>
                    <div className="space-y-2">
                      {day.items.map((item) => (
                        <LoanActivityItem key={item._id} item={item} />
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
