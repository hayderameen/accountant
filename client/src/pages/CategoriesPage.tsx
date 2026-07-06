import { useEffect, useState, type FormEvent } from 'react';
import { api, type Category } from '../api/client';

export function CategoriesPage() {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = () => api.getCategories(type).then(setCategories);

  useEffect(() => {
    load();
    resetForm();
  }, [type]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setError('');
  };

  const startEdit = (category: Category) => {
    setEditingId(category._id);
    setName(category.name);
    setError('');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');

    try {
      if (editingId) {
        await api.updateCategory(editingId, { name: name.trim() });
      } else {
        await api.createCategory({ name: name.trim(), type });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.deleteCategory(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Categories</h1>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {(['expense', 'income'] as const).map((t) => (
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

      <form onSubmit={onSubmit} className="mb-4 space-y-2 rounded-lg bg-zinc-900 p-3">
        <p className="text-sm text-zinc-400">{editingId ? 'Edit category' : `New ${type} category`}</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded bg-emerald-600 py-1.5 text-sm">
            {editingId ? 'Update' : 'Add'}
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
        {categories.length === 0 ? (
          <p className="text-sm text-zinc-500">No categories yet.</p>
        ) : (
          categories.map((c) => (
            <div key={c._id} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
              <span>{c.name}</span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => startEdit(c)} className="text-emerald-400">
                  Edit
                </button>
                <button onClick={() => onDelete(c._id)} className="text-red-400">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
