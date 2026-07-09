import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatMoney } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { FALLBACK_CURRENCY } from "../lib/currencies";

interface ImportPreview {
  accounts: number;
  categories: number;
  transactions: number;
  incomeTotal: number;
  expenseTotal: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [runAutomations, setRunAutomations] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.previewImport(file);
      setJobId(res.jobId);
      setPreview(res.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    if (!jobId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.confirmImport(jobId, runAutomations);
      setResult({ imported: res.imported, skipped: res.skipped });
      setPreview(null);
      setJobId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up">
      <h1 className="page-title mb-2">Import Money Manager</h1>
      <p className="mb-4 text-sm text-[var(--color-mist)]">
        Upload <code className="text-[var(--color-paper-muted)]">money_android.sqlite</code>{" "}
        (email backup) or <code className="text-[var(--color-paper-muted)]">.mmbak</code> (device
        backup — raw SQLite or zip).
      </p>

      {!result && (
        <form onSubmit={onPreview} className="panel mb-4 space-y-3 p-4">
          <input
            type="file"
            accept=".sqlite,.mmbak,.db,.MoneyManager2"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setJobId(null);
            }}
            className="field w-full text-sm"
          />
          <button
            type="submit"
            disabled={!file || loading}
            className="btn-ghost w-full disabled:opacity-50"
          >
            {loading ? "Parsing..." : "Preview import"}
          </button>
        </form>
      )}

      {preview && jobId && !result && (
        <div className="panel mb-4 space-y-3 p-3 text-sm">
          <p className="text-[var(--color-paper)]">{preview.accounts} accounts</p>
          <p className="text-[var(--color-paper)]">{preview.categories} categories</p>
          <p className="text-[var(--color-paper)]">{preview.transactions} transactions</p>
          <p className="amount-in">Income: {formatMoney(preview.incomeTotal, currency)}</p>
          <p className="amount-out">Expense: {formatMoney(preview.expenseTotal, currency)}</p>
          {preview.dateFrom && preview.dateTo && (
            <p className="text-[var(--color-mist)]">
              {new Date(preview.dateFrom).toLocaleDateString()} –{" "}
              {new Date(preview.dateTo).toLocaleDateString()}
            </p>
          )}

          <label className="flex items-center gap-2 text-[var(--color-paper-muted)]">
            <input
              type="checkbox"
              checked={runAutomations}
              onChange={(e) => setRunAutomations(e.target.checked)}
            />
            Run automations on imported income
          </label>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Importing..." : "Confirm import"}
          </button>
        </div>
      )}

      {result && (
        <div className="panel space-y-3 p-3 text-sm">
          <p className="text-[var(--color-sage-bright)]">Import complete</p>
          <p className="text-[var(--color-paper)]">{result.imported} transactions imported</p>
          <p className="text-[var(--color-paper)]">{result.skipped} duplicates skipped</p>
          <button type="button" onClick={() => navigate("/")} className="btn-primary">
            Go to dashboard
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
