import { useEffect, useState, type FormEvent } from "react";
import { api, formatMoney, type Account } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import { SkeletonList } from "../components/Skeleton";

export function AccountsPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    return api.getAccounts().then(setAccounts).finally(() => {
      if (showLoading) setLoading(false);
    });
  };

  useEffect(() => {
    load(true);
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
    <div className="fade-up">
      <h1 className="page-title mb-4">Accounts</h1>

      <form onSubmit={onSubmit} className="panel mb-4 space-y-2 p-3">
        <p className="text-sm text-[var(--color-mist)]">
          {editingId ? "Edit account" : "New account"}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="field text-sm"
          required
        />
        <input
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Balance"
          className="field text-sm"
          required
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="field text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {error && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1 text-sm">
            {editingId ? "Update" : "Add"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {loading ? <SkeletonList count={4} /> : accounts.map((a) => (
          <div key={a._id} className="list-row items-center">
            <div>
              <p className="font-medium text-[var(--color-paper)]">{a.name}</p>
              <p className="text-sm text-[var(--color-mist)]">
                {formatMoney(a.balance, a.currency)} · {a.currency}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => startEdit(a)}
                className="text-[var(--color-sage-bright)]"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(a._id)}
                style={{ color: "var(--color-red)" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
