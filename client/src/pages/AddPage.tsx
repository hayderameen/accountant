import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  formatMoney,
  type Account,
  type Category,
  type EntityWithBalances,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import { balanceForCurrency, owedCurrenciesFromEntities } from "../lib/loanTotals";
import { SkeletonForm } from "../components/Skeleton";

type AddType = "expense" | "income" | "transfer" | "repayment";

export function AddPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<AddType>("expense");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [entityId, setEntityId] = useState("");
  const [pendingLoans, setPendingLoans] = useState<EntityWithBalances[]>([]);
  const [takeBack, setTakeBack] = useState<EntityWithBalances[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [error, setError] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingEntities, setLoadingEntities] = useState(true);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const loadEntities = () => {
    setLoadingEntities(true);
    Promise.all([
      api.getEntities("i_owe"),
      api.getEntities("they_owe_me"),
    ]).then(([pending, takeback]) => {
      setPendingLoans(pending);
      setTakeBack(takeback);
    }).finally(() => setLoadingEntities(false));
  };

  useEffect(() => {
    if (type === "expense" || type === "repayment") {
      loadEntities();
    }
  }, [type, currency]);

  useEffect(() => {
    if (type !== "repayment") return;
    const owed = owedCurrenciesFromEntities(takeBack);
    if (owed.length > 0 && !owed.includes(currency)) {
      setCurrency(owed[0]);
      setEntityId("");
    }
  }, [type, takeBack, currency]);

  useEffect(() => {
    setEntityId("");
    setCategoryId("");
  }, [type]);

  useEffect(() => {
    api.getAccounts().then((a) => {
      setAccounts(a);
      if (a[0]) setAccountId(a[0]._id);
    }).finally(() => setLoadingAccounts(false));
  }, []);

  useEffect(() => {
    if (type === "transfer" || type === "repayment") {
      setCategories([]);
      setLoadingCategories(false);
      return;
    }
    setLoadingCategories(true);
    const catType = type === "income" ? "income" : "expense";
    api.getCategories(catType).then(setCategories).finally(() => setLoadingCategories(false));
  }, [type]);

  const createAccount = async () => {
    if (!newAccountName.trim()) return;
    const account = await api.createAccount({ name: newAccountName.trim() });
    setAccounts((prev) => [...prev, account]);
    setAccountId(account._id);
    setNewAccountName("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!accountId || !amountCents || amountCents <= 0) {
      setError("Account and valid amount required");
      return;
    }

    try {
      if (type === "repayment") {
        if (!entityId) {
          setError("Select who repaid you");
          return;
        }
        const owed = balanceForCurrency(selectedTakeBack!, currency);
        if (amountCents > owed) {
          setError(
            `Cannot repay more than ${formatMoney(owed, currency)} owed`,
          );
          return;
        }
        await api.createLoanTransaction({
          entityId,
          type: "repayment_received",
          amount: amountCents,
          currency,
          accountId,
          memo: memo || undefined,
        });
      } else {
        if (type === "expense" && entityId && selectedPending) {
          const remaining = balanceForCurrency(selectedPending, currency);
          if (amountCents > remaining) {
            setError(
              `Cannot pay more than ${formatMoney(remaining, currency)} remaining`,
            );
            return;
          }
        }
        await api.createTransaction({
          type,
          amount: amountCents,
          date: new Date().toISOString(),
          accountId,
          categoryId: categoryId || undefined,
          toAccountId: type === "transfer" ? toAccountId : undefined,
          entityId: type === "expense" && entityId ? entityId : undefined,
          currency,
          memo: memo || undefined,
        });
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const repaymentCurrencies = owedCurrenciesFromEntities(takeBack);
  const takeBackForCurrency = takeBack.filter(
    (e) => balanceForCurrency(e, currency) > 0,
  );
  const pendingForCurrency = pendingLoans.filter(
    (e) => balanceForCurrency(e, currency) > 0,
  );

  const selectedTakeBack = takeBack.find((e) => e._id === entityId);
  const selectedPending = pendingLoans.find((e) => e._id === entityId);
  const maxRepaymentCents =
    type === "repayment" && selectedTakeBack
      ? balanceForCurrency(selectedTakeBack, currency)
      : undefined;
  const maxExpenseLoanCents =
    type === "expense" && selectedPending
      ? balanceForCurrency(selectedPending, currency)
      : undefined;
  const maxAmountCents = maxRepaymentCents ?? maxExpenseLoanCents;
  const dataLoading =
    loadingAccounts ||
    ((type === "expense" || type === "repayment") && loadingEntities) ||
    ((type === "expense" || type === "income") && loadingCategories);

  return (
    <div className="fade-up">
      <h1 className="page-title mb-4">Add</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["expense", "Expense"],
            ["income", "Income"],
            ["transfer", "Transfer"],
            ["repayment", "Repayment"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`chip ${type === t ? "chip-active" : "chip-idle"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {type === "repayment" && (
        <p className="mb-4 text-sm text-[var(--color-mist)]">
          Record money someone paid back. Does not count as income.
        </p>
      )}

      {dataLoading ? (
        <SkeletonForm fields={type === "repayment" ? 5 : 4} />
      ) : accounts.length === 0 ? (
        <div className="panel mb-4 space-y-2 p-3">
          <p className="text-sm text-[var(--color-mist)]">Create your first account</p>
          <div className="flex gap-2">
            <input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. Cash"
              className="field flex-1 text-sm"
            />
            <button
              type="button"
              onClick={createAccount}
              className="btn-ghost shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="field"
          >
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>

          {type === "transfer" && (
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="field"
              required
            >
              <option value="">To account</option>
              {accounts
                .filter((a) => a._id !== accountId)
                .map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
            </select>
          )}

          {type === "repayment" && (
            <>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setEntityId("");
                }}
                className="field"
              >
                {repaymentCurrencies.length === 0 ? (
                  <option value="">No amounts owed</option>
                ) : (
                  repaymentCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="field"
                required
              >
                <option value="">Who repaid you?</option>
                {takeBackForCurrency.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name} (
                    {formatMoney(balanceForCurrency(e, currency), currency)} owed)
                  </option>
                ))}
              </select>
            </>
          )}

          {type !== "transfer" && type !== "repayment" && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="field"
            >
              <option value="">Category (optional)</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {type !== "repayment" && (
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setEntityId("");
              }}
              className="field"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {type === "expense" && pendingForCurrency.length > 0 && (
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="field"
            >
              <option value="">Link to pending loan (optional)</option>
              {pendingForCurrency.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} (
                  {formatMoney(balanceForCurrency(e, currency), currency)} left)
                </option>
              ))}
            </select>
          )}

          <input
            type="number"
            step="0.01"
            min="0.01"
            max={maxAmountCents ? maxAmountCents / 100 : undefined}
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field"
            required
          />
          {maxAmountCents !== undefined && (
            <p className="text-xs text-[var(--color-mist)]">
              Max {formatMoney(maxAmountCents, currency)}
            </p>
          )}

          <input
            type="text"
            placeholder="Memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="field"
          />

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
