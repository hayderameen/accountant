import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatMoney } from '../api/client';
import { useAuth } from '../hooks/useAuth';

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
  const currency = user?.settings?.defaultCurrency ?? 'USD';
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [runAutomations, setRunAutomations] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.previewImport(file);
      setJobId(res.jobId);
      setPreview(res.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    if (!jobId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.confirmImport(jobId, runAutomations);
      setResult({ imported: res.imported, skipped: res.skipped });
      setPreview(null);
      setJobId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold">Import Money Manager</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Upload <code className="text-zinc-300">money_android.sqlite</code> (email backup) or{' '}
        <code className="text-zinc-300">.mmbak</code> (device backup — raw SQLite or zip).
      </p>

      {!result && (
        <form onSubmit={onPreview} className="mb-4 space-y-3">
          <input
            type="file"
            accept=".sqlite,.mmbak,.db,.MoneyManager2"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setJobId(null);
            }}
            className="w-full text-sm"
          />
          <button
            type="submit"
            disabled={!file || loading}
            className="w-full rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? 'Parsing...' : 'Preview import'}
          </button>
        </form>
      )}

      {preview && jobId && !result && (
        <div className="mb-4 space-y-3 rounded-lg bg-zinc-900 p-3 text-sm">
          <p>{preview.accounts} accounts</p>
          <p>{preview.categories} categories</p>
          <p>{preview.transactions} transactions</p>
          <p>Income: {formatMoney(preview.incomeTotal, currency)}</p>
          <p>Expense: {formatMoney(preview.expenseTotal, currency)}</p>
          {preview.dateFrom && preview.dateTo && (
            <p className="text-zinc-400">
              {new Date(preview.dateFrom).toLocaleDateString()} –{' '}
              {new Date(preview.dateTo).toLocaleDateString()}
            </p>
          )}

          <label className="flex items-center gap-2">
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
            className="w-full rounded-lg bg-emerald-600 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Confirm import'}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-lg bg-zinc-900 p-3 text-sm">
          <p className="text-emerald-400">Import complete</p>
          <p>{result.imported} transactions imported</p>
          <p>{result.skipped} duplicates skipped</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full rounded-lg bg-emerald-600 py-2"
          >
            Go to dashboard
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
