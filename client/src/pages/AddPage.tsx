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
import { balanceForCurrency } from "../lib/loanTotals";

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

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const loadEntities = () => {
    api.getEntities("i_owe").then(setPendingLoans);
    api.getEntities("they_owe_me").then(setTakeBack);
  };

  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    if (type === "expense" || type === "repayment") {
      loadEntities();
    }
  }, [type, currency]);

  useEffect(() => {
    setEntityId("");
    setCategoryId("");
  }, [type]);

  useEffect(() => {
    api.getAccounts().then((a) => {
      setAccounts(a);
      if (a[0]) setAccountId(a[0]._id);
    });
  }, []);

  useEffect(() => {
    if (type === "transfer" || type === "repayment") {
      setCategories([]);
      return;
    }
    const catType = type === "income" ? "income" : "expense";
    api.getCategories(catType).then(setCategories);
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
        await api.createLoanTransaction({
          entityId,
          type: "repayment_received",
          amount: amountCents,
          currency,
          accountId,
          memo: memo || undefined,
        });
      } else {
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

  const takeBackForCurrency = takeBack.filter(
    (e) => balanceForCurrency(e, currency) > 0,
  );
  const pendingForCurrency = pendingLoans.filter(
    (e) => balanceForCurrency(e, currency) > 0,
  );

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Add</h1>

      <div className="mb-4 grid grid-cols-2 gap-2">
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
            className={`rounded-lg py-2 text-sm ${
              type === t ? "bg-emerald-600" : "bg-zinc-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {type === "repayment" && (
        <p className="mb-4 text-sm text-zinc-400">
          Record money someone paid back. Does not count as income.
        </p>
      )}

      {accounts.length === 0 ? (
        <div className="mb-4 space-y-2 rounded-lg bg-zinc-900 p-3">
          <p className="text-sm text-zinc-400">Create your first account</p>
          <div className="flex gap-2">
            <input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. Cash"
              className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={createAccount}
              className="rounded bg-emerald-600 px-3 py-1 text-sm"
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
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
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            required
          />

          <input
            type="text"
            placeholder="Memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 py-2 font-medium hover:bg-emerald-500"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}
