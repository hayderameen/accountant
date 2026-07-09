import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type EntityWithBalances } from "../api/client";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanCurrencySummary } from "../components/LoanCurrencySummary";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import {
  balanceForCurrency,
  flattenEntityBalances,
  owedCurrenciesFromBalances,
} from "../lib/loanTotals";

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
        setError(
          `Cannot repay more than ${(owed / 100).toFixed(2)} ${loanCurrency} owed`,
        );
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
    <div className="fade-up">
      <h1 className="page-title mb-4">Loans</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`chip ${tab === "pending" ? "chip-active" : "chip-idle"}`}
        >
          Pending Loans
        </button>
        <button
          type="button"
          onClick={() => setTab("takeback")}
          className={`chip ${tab === "takeback" ? "chip-active" : "chip-idle"}`}
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

      <form onSubmit={addEntity} className="panel mb-4 space-y-2 p-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              tab === "pending" ? "e.g. Charity, Car Loan" : "e.g. John Doe"
            }
            className="field flex-1 text-sm"
          />
          <button type="submit" className="btn-ghost shrink-0">
            Add
          </button>
        </div>
        <p className="text-xs text-[var(--color-mist)]">
          Default currency for new entries
        </p>
        <select
          value={entityCurrency}
          onChange={(e) => setEntityCurrency(e.target.value)}
          className="field text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </form>

      {tab === "pending" && entities.length > 0 && (
        <form onSubmit={addObligation} className="panel mb-4 space-y-2 p-3">
          <p className="text-sm text-[var(--color-mist)]">
            Add amount you owe (manual)
          </p>
          <select
            value={obligationEntity}
            onChange={(e) => setObligationEntity(e.target.value)}
            className="field text-sm"
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
            className="field text-sm"
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
            className="field text-sm"
          />
          <button type="submit" className="btn-primary text-sm">
            Add owed amount
          </button>
        </form>
      )}

      {tab === "takeback" && entities.length > 0 && (
        <form onSubmit={addLoanTxn} className="panel mb-4 space-y-2 p-3">
          <p className="text-sm text-[var(--color-mist)]">
            Record loan or repayment
          </p>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="field text-sm"
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
            className="field text-sm"
          >
            <option value="loan_given">They borrowed (increase owed)</option>
            <option value="repayment_received">
              They repaid (decrease owed)
            </option>
          </select>
          <select
            value={loanCurrency}
            onChange={(e) => setLoanCurrency(e.target.value)}
            className="field text-sm"
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
            className="field text-sm"
          />
          {repaymentMaxCents !== undefined && (
            <p className="text-xs text-[var(--color-mist)]">
              Max {(repaymentMaxCents / 100).toFixed(2)} {loanCurrency}
            </p>
          )}
          <button type="submit" className="btn-primary text-sm">
            Record
          </button>
        </form>
      )}

      {error && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{
            color: "var(--color-red)",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.18)",
          }}
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        {entities.length === 0 ? (
          <p className="text-sm text-[var(--color-mist)]">No entries yet.</p>
        ) : (
          entities.map((e) => (
            <Link key={e._id} to={`/loans/${e._id}`} className="list-row">
              <p className="font-medium text-[var(--color-paper)]">{e.name}</p>
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
