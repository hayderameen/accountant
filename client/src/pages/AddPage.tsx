import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Account, type Category } from '../api/client';

export function AddPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAccounts().then((a) => {
      setAccounts(a);
      if (a[0]) setAccountId(a[0]._id);
    });
  }, []);

  useEffect(() => {
    const catType = type === 'income' ? 'income' : 'expense';
    if (type === 'transfer') {
      setCategories([]);
      return;
    }
    api.getCategories(catType).then(setCategories);
  }, [type]);

  const createAccount = async () => {
    if (!newAccountName.trim()) return;
    const account = await api.createAccount({ name: newAccountName.trim() });
    setAccounts((prev) => [...prev, account]);
    setAccountId(account._id);
    setNewAccountName('');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!accountId || !amountCents || amountCents <= 0) {
      setError('Account and valid amount required');
      return;
    }

    try {
      await api.createTransaction({
        type,
        amount: amountCents,
        date: new Date().toISOString(),
        accountId,
        categoryId: categoryId || undefined,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
        memo: memo || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Add</h1>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-lg py-2 text-sm capitalize ${
              type === t ? 'bg-emerald-600' : 'bg-zinc-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

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

          {type === 'transfer' && (
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
              required
            >
              <option value="">To account</option>
              {accounts.filter((a) => a._id !== accountId).map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {type !== 'transfer' && (
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
