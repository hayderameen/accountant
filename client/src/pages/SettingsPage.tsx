import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../api/client";

import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [currency, setCurrency] = useState(
    user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY,
  );
  const [runAutomationsOnImport, setRunAutomationsOnImport] = useState(
    user?.settings?.runAutomationsOnImport ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.settings) {
      setCurrency(user.settings.defaultCurrency);
      setRunAutomationsOnImport(user.settings.runAutomationsOnImport);
    }
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api.updateSettings({
        defaultCurrency: currency,
        runAutomationsOnImport,
      });
      await refreshUser();
      setMessage("Saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Settings</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Default currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={runAutomationsOnImport}
            onChange={(e) => setRunAutomationsOnImport(e.target.checked)}
          />
          Run income automations on imported Money Manager income
        </label>

        {message && <p className="text-sm text-zinc-400">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
