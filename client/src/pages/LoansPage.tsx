import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney, type EntityWithSummary } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";

type Tab = "pending" | "takeback";

export function LoansPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [tab, setTab] = useState<Tab>("pending");
  const [entities, setEntities] = useState<EntityWithSummary[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [entityCurrency, setEntityCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [obligationEntity, setObligationEntity] = useState("");
  const [loanAction, setLoanAction] = useState<
    "loan_given" | "repayment_received"
  >("loan_given");
  const [error, setError] = useState("");

  const direction = tab === "pending" ? "i_owe" : "they_owe_me";

  const summaryByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    if (tab === "pending") {
      for (const e of entities) {
        const c = e.currency ?? FALLBACK_CURRENCY;
        map.set(c, (map.get(c) ?? 0) + e.obligationSummary.remaining);
      }
    } else {
      for (const e of entities) {
        const c = e.currency ?? FALLBACK_CURRENCY;
        map.set(c, (map.get(c) ?? 0) + (balances[e._id] ?? 0));
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entities, balances, tab]);

  const load = async () => {
    const [list, loanBalances] = await Promise.all([
      api.getEntities(direction),
      tab === "takeback"
        ? api.getLoanBalances("they_owe_me")
        : Promise.resolve([]),
    ]);
    setEntities(list);
    if (tab === "takeback") {
      setBalances(
        Object.fromEntries(loanBalances.map((e) => [e._id, e.loanBalance])),
      );
    }
  };

  useEffect(() => {
    setEntityCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    load();
    setName("");
    setAmount("");
    setSelectedEntity("");
    setObligationEntity("");
    setError("");
  }, [tab]);

  const addEntity = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      await api.createEntity({
        name: name.trim(),
        direction,
        currency: entityCurrency,
      });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const addObligation = async (e: FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!obligationEntity || !cents || cents <= 0) return;
    setError("");
    try {
      await api.createManualObligation(obligationEntity, cents);
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const addLoanTxn = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEntity) return;
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) return;
    setError("");
    try {
      await api.createLoanTransaction({
        entityId: selectedEntity,
        type: loanAction,
        amount: cents,
      });
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Loans</h1>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`rounded-lg py-2 text-sm ${tab === "pending" ? "bg-emerald-600" : "bg-zinc-900"}`}
        >
          Pending Loans
        </button>
        <button
          type="button"
          onClick={() => setTab("takeback")}
          className={`rounded-lg py-2 text-sm ${tab === "takeback" ? "bg-emerald-600" : "bg-zinc-900"}`}
        >
          Money to Take Back
        </button>
      </div>

      {summaryByCurrency.length > 0 && (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2.5">
          <p className="mb-2 text-sm font-semibold text-zinc-200">
            {tab === "pending" ? "Total remaining" : "Total owed to you"}
          </p>
          <div className="space-y-1">
            {summaryByCurrency.map(([currency, total]) => (
              <p
                key={currency}
                className={`text-sm font-medium ${tab === "pending" ? "text-rose-300" : "text-emerald-300"}`}
              >
                {formatMoney(total, currency)}
              </p>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={addEntity} className="mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              tab === "pending" ? "e.g. Charity, Mutual Funds" : "e.g. Ahmed"
            }
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"
          >
            Add
          </button>
        </div>
        <select
          value={entityCurrency}
          onChange={(e) => setEntityCurrency(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </form>

      {tab === "pending" && entities.length > 0 && (
        <form
          onSubmit={addObligation}
          className="mb-4 space-y-2 rounded-lg bg-zinc-900 p-3"
        >
          <p className="text-sm text-zinc-400">Add amount you owe (manual)</p>
          <select
            value={obligationEntity}
            onChange={(e) => setObligationEntity(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            <option value="">Select pending loan</option>
            {entities.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount owed"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded bg-emerald-600 py-1.5 text-sm"
          >
            Add owed amount
          </button>
        </form>
      )}

      {tab === "takeback" && entities.length > 0 && (
        <form
          onSubmit={addLoanTxn}
          className="mb-4 space-y-2 rounded-lg bg-zinc-900 p-3"
        >
          <p className="text-sm text-zinc-400">Record loan or repayment</p>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            <option value="">Select person</option>
            {entities.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={loanAction}
            onChange={(e) => setLoanAction(e.target.value as typeof loanAction)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            <option value="loan_given">They borrowed (increase owed)</option>
            <option value="repayment_received">
              They repaid (decrease owed)
            </option>
          </select>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded bg-emerald-600 py-1.5 text-sm"
          >
            Record
          </button>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {entities.length === 0 ? (
          <p className="text-sm text-zinc-500">No entries yet.</p>
        ) : (
          entities.map((e) => (
            <Link
              key={e._id}
              to={`/loans/${e._id}`}
              className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2.5 hover:bg-zinc-800"
            >
              <div>
                <p className="font-medium">{e.name}</p>
                <p className="text-xs text-zinc-500">
                  {e.currency ?? FALLBACK_CURRENCY}
                </p>
              </div>
              {tab === "pending" ? (
                <p className="text-sm text-rose-300">
                  {formatMoney(
                    e.obligationSummary.remaining,
                    e.currency ?? FALLBACK_CURRENCY,
                  )}{" "}
                  remaining
                </p>
              ) : (
                <p className="text-sm text-emerald-300">
                  {formatMoney(
                    balances[e._id] ?? 0,
                    e.currency ?? FALLBACK_CURRENCY,
                  )}{" "}
                  owed to you
                </p>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
