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
    <div className="fade-up">
      <h1 className="page-title mb-4">Settings</h1>
      <form onSubmit={onSubmit} className="panel space-y-4 p-3">
        <div>
          <label className="section-label mb-1 block">
            Default currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="field"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-paper-muted)]">
          <input
            type="checkbox"
            checked={runAutomationsOnImport}
            onChange={(e) => setRunAutomationsOnImport(e.target.checked)}
          />
          Run income automations on imported Money Manager income
        </label>

        {message === "Saved" && (
          <p className="text-sm" style={{ color: "var(--color-green)" }}>Saved</p>
        )}
        {message && message !== "Saved" && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
