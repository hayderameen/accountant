import { useEffect, useState, type FormEvent } from 'react';
import { api, type Category } from '../api/client';
import { SkeletonList } from '../components/Skeleton';
import { LoadingLabel } from '../components/LoadingLabel';

export function CategoriesPage() {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    return api.getCategories(type).then(setCategories).finally(() => {
      if (showLoading) setLoading(false);
    });
  };

  useEffect(() => {
    load(true);
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

    setSaving(true);
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
    } finally {
      setSaving(false);
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
    <div className="fade-up">
      <h1 className="page-title mb-4">Categories</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`chip capitalize ${type === t ? 'chip-active' : 'chip-idle'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="panel mb-4 space-y-2 p-3"
        aria-busy={saving}
        inert={saving ? true : undefined}
      >
        <p className="text-sm text-[var(--color-mist)]">
          {editingId ? 'Edit category' : `New ${type} category`}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="field text-sm"
          required
        />
        {error && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1 text-sm" disabled={saving}>
            {saving
              ? <LoadingLabel>{editingId ? 'Updating…' : 'Adding…'}</LoadingLabel>
              : editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {loading ? (
          <SkeletonList count={5} subtitle={false} />
        ) : categories.length === 0 ? (
          <p className="text-sm text-[var(--color-mist)]">No categories yet.</p>
        ) : (
          categories.map((c) => (
            <div key={c._id} className="list-row items-center">
              <span className="text-[var(--color-paper)]">{c.name}</span>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => startEdit(c)}
                  className="text-[var(--color-sage-bright)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(c._id)}
                  style={{ color: "var(--color-red)" }}
                >
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
