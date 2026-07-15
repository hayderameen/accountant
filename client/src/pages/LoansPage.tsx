import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type EntityWithBalances } from "../api/client";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { LoanCurrencySummary } from "../components/LoanCurrencySummary";
import {
  SkeletonBlock,
  SkeletonList,
  SkeletonSummary,
} from "../components/Skeleton";
import { LoadingLabel } from "../components/LoadingLabel";
import { useAuth } from "../hooks/useAuth";
import { useCachedQuery } from "../hooks/useDataSync";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import {
  balanceForCurrency,
  flattenEntityBalances,
  owedCurrenciesFromBalances,
} from "../lib/loanTotals";

type Tab = "pending" | "takeback";

type LoansData = {
  pendingLoans: EntityWithBalances[];
  takeBack: EntityWithBalances[];
  entities: EntityWithBalances[];
};

export function LoansPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [tab, setTab] = useState<Tab>("pending");
  const [name, setName] = useState("");
  const [entityDirection, setEntityDirection] = useState<
    "i_owe" | "they_owe_me"
  >("i_owe");
  const [initialAmount, setInitialAmount] = useState("");
  const [entityCurrency, setEntityCurrency] = useState(defaultCurrency);
  const [obligationCurrency, setObligationCurrency] = useState(defaultCurrency);
  const [loanCurrency, setLoanCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [obligationEntity, setObligationEntity] = useState("");
  const [loanAction, setLoanAction] = useState<
    "loan_given" | "repayment_received"
  >("loan_given");
  const [error, setError] = useState("");
  const [entityError, setEntityError] = useState("");
  const [submitting, setSubmitting] = useState<
    "entity" | "obligation" | "loan" | null
  >(null);

  const tabDirection = tab === "pending" ? "i_owe" : "they_owe_me";

  const { data, loading, reload } = useCachedQuery<LoansData>(
    `loans:${tab}`,
    async () => {
      const [pendingLoans, takeBack, entities] = await Promise.all([
        api.getEntities("i_owe"),
        api.getEntities("they_owe_me"),
        api.getEntities(tabDirection),
      ]);
      return { pendingLoans, takeBack, entities };
    },
    [tab, tabDirection],
  );

  const pendingLoans = data?.pendingLoans ?? [];
  const takeBack = data?.takeBack ?? [];
  const entities = data?.entities ?? [];

  const pendingTotals = useMemo(
    () => flattenEntityBalances(pendingLoans),
    [pendingLoans],
  );

  const takeBackTotals = useMemo(
    () => flattenEntityBalances(takeBack),
    [takeBack],
  );

  useEffect(() => {
    setEntityCurrency(defaultCurrency);
    setObligationCurrency(defaultCurrency);
    setLoanCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    setName("");
    setEntityDirection(tabDirection);
    setInitialAmount("");
    setAmount("");
    setMemo("");
    setSelectedEntity("");
    setObligationEntity("");
    setError("");
    setEntityError("");
  }, [tab, tabDirection]);

  const addEntity = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const initialAmountCents = Math.round(parseFloat(initialAmount) * 100);
    if (!trimmedName || !initialAmountCents || initialAmountCents <= 0) return;
    setEntityError("");
    const duplicate = [...pendingLoans, ...takeBack].some(
      (entity) =>
        entity.name.trim().toLocaleLowerCase() ===
        trimmedName.toLocaleLowerCase(),
    );
    if (duplicate) {
      setEntityError("An entity with this name already exists");
      return;
    }
    setSubmitting("entity");
    try {
      await api.createEntity({
        name: trimmedName,
        direction: entityDirection,
        currency: entityCurrency,
        initialAmount: initialAmountCents,
      });
      setName("");
      setInitialAmount("");
      const targetTab = entityDirection === "i_owe" ? "pending" : "takeback";
      if (targetTab === tab) await reload();
      else setTab(targetTab);
    } catch (err) {
      setEntityError(
        err instanceof Error ? err.message : "Failed to add entity",
      );
    } finally {
      setSubmitting(null);
    }
  };

  const addObligation = async (e: FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!obligationEntity || !cents || cents <= 0) return;
    setError("");
    setSubmitting("obligation");
    try {
      await api.createManualObligation(
        obligationEntity,
        cents,
        obligationCurrency,
        memo.trim() || undefined,
      );
      setAmount("");
      setMemo("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(null);
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
    setSubmitting("loan");
    try {
      await api.createLoanTransaction({
        entityId: selectedEntity,
        type: loanAction,
        amount: cents,
        currency: loanCurrency,
        memo: memo.trim() || undefined,
      });
      setAmount("");
      setMemo("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(null);
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

      {loading && (
        <div aria-label="Loading loans" role="status">
          <SkeletonSummary />
          <SkeletonSummary />
          <div className="panel mb-4 space-y-2 p-3">
            <SkeletonBlock className="block h-11 w-full rounded-xl" />
            <SkeletonBlock className="block h-3 w-40" />
            <SkeletonBlock className="block h-11 w-full rounded-xl" />
          </div>
          <SkeletonList count={4} subtitle={false} />
        </div>
      )}

      {!loading && (
        <>
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

          <form
            onSubmit={addEntity}
            className="panel mb-4 space-y-2 p-3"
            aria-busy={submitting === "entity"}
            inert={submitting ? true : undefined}
          >
            <p className="section-label">Add new loan</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEntityDirection("i_owe")}
                className={`chip flex-1 ${
                  entityDirection === "i_owe" ? "chip-active" : "chip-idle"
                }`}
              >
                Loan taken
              </button>
              <button
                type="button"
                onClick={() => setEntityDirection("they_owe_me")}
                className={`chip flex-1 ${
                  entityDirection === "they_owe_me"
                    ? "chip-active"
                    : "chip-idle"
                }`}
              >
                Loan given
              </button>
            </div>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setEntityError("");
              }}
              placeholder="Person or entity name"
              className="field text-sm"
              required
            />
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
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              placeholder="Initial loan amount"
              className="field text-sm"
              required
            />
            {entityError && (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  color: "var(--color-red)",
                  background: "rgba(255,69,58,0.08)",
                  border: "1px solid rgba(255,69,58,0.18)",
                }}
              >
                {entityError}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={Boolean(submitting)}
            >
              {submitting === "entity" ? (
                <LoadingLabel>Adding…</LoadingLabel>
              ) : entityDirection === "i_owe" ? (
                "Add loan taken"
              ) : (
                "Add loan given"
              )}
            </button>
          </form>

          {tab === "pending" && entities.length > 0 && (
            <form
              onSubmit={addObligation}
              className="panel mb-4 space-y-2 p-3"
              aria-busy={submitting === "obligation"}
              inert={submitting ? true : undefined}
            >
              <p className="text-mist text-sm">Add amount you owe (manual)</p>
              <select
                value={obligationEntity}
                onChange={(e) => setObligationEntity(e.target.value)}
                className="field text-sm"
              >
                <option value="">Select person/entity</option>
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
              <input
                type="text"
                placeholder="Memo (optional)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="field text-sm"
              />
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={Boolean(submitting)}
              >
                {submitting === "obligation" ? (
                  <LoadingLabel>Adding…</LoadingLabel>
                ) : (
                  "Add owed amount"
                )}
              </button>
            </form>
          )}

          {tab === "takeback" && entities.length > 0 && (
            <form
              onSubmit={addLoanTxn}
              className="panel mb-4 space-y-2 p-3"
              aria-busy={submitting === "loan"}
              inert={submitting ? true : undefined}
            >
              <p className="text-mist text-sm">Record loan or repayment</p>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="field text-sm"
              >
                <option value="">Select person/entity</option>
                {entities.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <select
                value={loanAction}
                onChange={(e) =>
                  setLoanAction(e.target.value as typeof loanAction)
                }
                className="field text-sm"
              >
                <option value="loan_given">
                  They borrowed (increase owed)
                </option>
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
                <p className="text-mist text-xs">
                  Max {(repaymentMaxCents / 100).toFixed(2)} {loanCurrency}
                </p>
              )}
              <input
                type="text"
                placeholder="Memo (optional)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="field text-sm"
              />
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={Boolean(submitting)}
              >
                {submitting === "loan" ? (
                  <LoadingLabel>Recording…</LoadingLabel>
                ) : (
                  "Record"
                )}
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
              <p className="text-mist text-sm">No entries yet.</p>
            ) : (
              entities.map((e) => (
                <Link key={e._id} to={`/loans/${e._id}`} className="list-row">
                  <p className="text-paper font-medium">{e.name}</p>
                  <EntityBalanceLines
                    balances={e.balancesByCurrency}
                    variant={tab === "pending" ? "owed" : "owedToYou"}
                  />
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
