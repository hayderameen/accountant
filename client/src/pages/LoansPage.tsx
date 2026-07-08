import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type EntityWithBalances } from "../api/client";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanCurrencySummary } from "../components/LoanCurrencySummary";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import { balanceForCurrency, flattenEntityBalances, owedCurrenciesFromBalances } from "../lib/loanTotals";

type Tab = "pending" | "takeback";

export function LoansPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [tab, setTab] = useState<Tab>("pending");
  const [pendingLoans, setPendingLoans] = useState<EntityWithBalances[]>([]);
  const [takeBack, setTakeBack] = useState<EntityWithBalances[]>([]);
  const [entities, setEntities] = useState<EntityWithBalances[]>([]);
  const [name, setName] = useState("");
  const [entityCurrency, setEntityCurrency] = useState(defaultCurrency);
  const [obligationCurrency, setObligationCurrency] = useState(defaultCurrency);
  const [loanCurrency, setLoanCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [obligationEntity, setObligationEntity] = useState("");
  const [loanAction, setLoanAction] = useState<
    "loan_given" | "repayment_received"
  >("loan_given");
  const [error, setError] = useState("");

  const direction = tab === "pending" ? "i_owe" : "they_owe_me";

  const pendingTotals = useMemo(
    () => flattenEntityBalances(pendingLoans),
    [pendingLoans],
  );

  const takeBackTotals = useMemo(
    () => flattenEntityBalances(takeBack),
    [takeBack],
  );

  const load = async () => {
    const [pending, takeback, list] = await Promise.all([
      api.getEntities("i_owe"),
      api.getEntities("they_owe_me"),
      api.getEntities(direction),
    ]);
    setPendingLoans(pending);
    setTakeBack(takeback);
    setEntities(list);
  };

  useEffect(() => {
    setEntityCurrency(defaultCurrency);
    setObligationCurrency(defaultCurrency);
    setLoanCurrency(defaultCurrency);
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
      await api.createManualObligation(
        obligationEntity,
        cents,
        obligationCurrency,
      );
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
    const entity = entities.find((item) => item._id === selectedEntity);
    if (loanAction === "repayment_received" && entity) {
      const owed = balanceForCurrency(entity, loanCurrency);
      if (cents > owed) {
        setError(`Cannot repay more than ${(owed / 100).toFixed(2)} ${loanCurrency} owed`);
        return;
      }
    }
    try {
      await api.createLoanTransaction({
        entityId: selectedEntity,
        type: loanAction,
        amount: cents,
        currency: loanCurrency,
      });
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  useEffect(() => {
    if (loanAction !== "repayment_received" || !selectedEntity) return;
    const entity = entities.find((e) => e._id === selectedEntity);
    if (!entity) return;
    const owed = owedCurrenciesFromBalances(entity.balancesByCurrency);
    if (owed.length > 0 && !owed.includes(loanCurrency)) {
      setLoanCurrency(owed[0]);
    }
  }, [loanAction, selectedEntity, entities, loanCurrency]);

  const selectedLoanEntity = entities.find((e) => e._id === selectedEntity);
  const loanCurrencyOptions =
    loanAction === "repayment_received" && selectedLoanEntity
      ? owedCurrenciesFromBalances(selectedLoanEntity.balancesByCurrency)
      : CURRENCIES;
  const repaymentMaxCents =
    loanAction === "repayment_received" && selectedLoanEntity
      ? balanceForCurrency(selectedLoanEntity, loanCurrency)
      : undefined;

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

      <LoanCurrencySummary
        title="Total remaining"
        totals={pendingTotals}
        variant="owed"
      />
      <LoanCurrencySummary
        title="Total owed to you"
        totals={takeBackTotals}
        variant="owedToYou"
      />

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
        <p className="text-xs text-zinc-500">Default currency for new entries</p>
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
          <select
            value={obligationCurrency}
            onChange={(e) => setObligationCurrency(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
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
          <select
            value={loanCurrency}
            onChange={(e) => setLoanCurrency(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {loanCurrencyOptions.length === 0 ? (
              <option value="">No amounts owed</option>
            ) : (
              loanCurrencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            )}
          </select>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={repaymentMaxCents ? repaymentMaxCents / 100 : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          {repaymentMaxCents !== undefined && (
            <p className="text-xs text-zinc-500">
              Max {(repaymentMaxCents / 100).toFixed(2)} {loanCurrency}
            </p>
          )}
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
              <p className="font-medium">{e.name}</p>
              <EntityBalanceLines
                balances={e.balancesByCurrency}
                variant={tab === "pending" ? "owed" : "owedToYou"}
              />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
