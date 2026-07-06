import { useEffect, useState, type FormEvent } from "react";
import { api, formatMoney, type Account } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";

export function AccountsPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState("");

  const load = () => api.getAccounts().then(setAccounts);

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setBalance("");
    setCurrency(defaultCurrency);
    setError("");
  };

  const startEdit = (account: Account) => {
    setEditingId(account._id);
    setName(account.name);
    setBalance((account.balance / 100).toFixed(2));
    setCurrency(account.currency);
    setError("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const balanceCents = Math.round(parseFloat(balance) * 100);
    if (!name.trim() || Number.isNaN(balanceCents)) {
      setError("Name and valid balance required");
      return;
    }

    try {
      if (editingId) {
        await api.updateAccount(editingId, {
          name: name.trim(),
          balance: balanceCents,
          currency,
        });
      } else {
        await api.createAccount({
          name: name.trim(),
          balance: balanceCents,
          currency,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this account?")) return;
    try {
      await api.deleteAccount(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Accounts</h1>

      <form
        onSubmit={onSubmit}
        className="mb-4 space-y-2 rounded-lg bg-zinc-900 p-3"
      >
        <p className="text-sm text-zinc-400">
          {editingId ? "Edit account" : "New account"}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Balance"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          required
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded bg-emerald-600 py-1.5 text-sm"
          >
            {editingId ? "Update" : "Add"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded bg-zinc-800 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {accounts.map((a) => (
          <div
            key={a._id}
            className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2"
          >
            <div>
              <p className="font-medium">{a.name}</p>
              <p className="text-sm text-zinc-400">
                {formatMoney(a.balance, a.currency)} · {a.currency}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => startEdit(a)} className="text-emerald-400">
                Edit
              </button>
              <button onClick={() => onDelete(a._id)} className="text-red-400">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
