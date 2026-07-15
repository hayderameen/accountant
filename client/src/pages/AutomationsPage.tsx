import { useEffect, useState, type FormEvent } from "react";
import { api, type Automation, type Entity } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useCachedQuery } from "../hooks/useDataSync";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";
import { SkeletonList } from "../components/Skeleton";
import { LoadingLabel } from "../components/LoadingLabel";

type AutomationsData = {
  automations: Automation[];
  pendingLoans: Entity[];
};

export function AutomationsPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const { data, loading, reload } = useCachedQuery<AutomationsData>(
    "automations",
    async () => {
      const [automations, pendingLoans] = await Promise.all([
        api.getAutomations(),
        api.getEntities("i_owe"),
      ]);
      return { automations, pendingLoans };
    },
  );
  const automations = data?.automations ?? [];
  const pendingLoans = data?.pendingLoans ?? [];
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const [useNewEntity, setUseNewEntity] = useState(true);
  const [newEntityName, setNewEntityName] = useState("");
  const [entityCurrency, setEntityCurrency] = useState(defaultCurrency);
  const [targetEntityId, setTargetEntityId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEntityCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const entityName = (entity: Entity | string) =>
    typeof entity === "object"
      ? `${entity.name} (${entity.currency ?? FALLBACK_CURRENCY})`
      : "Unknown";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const pct = parseFloat(percentage);
    if (!name.trim() || Number.isNaN(pct) || pct <= 0 || pct > 100) {
      setError("Name and valid percentage (1-100) required");
      return;
    }

    setSaving(true);
    try {
      await api.createAutomation({
        name: name.trim(),
        percentage: pct,
        ...(useNewEntity
          ? {
              newEntityName: newEntityName.trim() || name.trim(),
              entityCurrency,
            }
          : { targetEntityId }),
      });
      setName("");
      setPercentage("");
      setNewEntityName("");
      setTargetEntityId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Automation) => {
    await api.updateAutomation(a._id, { active: !a.active });
    await reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    await api.deleteAutomation(id);
    await reload();
  };

  return (
    <div className="fade-up">
      <h1 className="page-title mb-4">Automations</h1>
      <p className="mb-4 text-sm text-[var(--color-mist)]">
        On each income, create a pending loan obligation as a % of that income.
      </p>

      <form
        onSubmit={onSubmit}
        className="panel mb-6 space-y-3 p-3"
        aria-busy={saving}
        inert={saving ? true : undefined}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name e.g. Charity 10%"
          className="field text-sm"
        />
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="100"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          placeholder="Percentage of income"
          className="field text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUseNewEntity(true)}
            className={`chip ${useNewEntity ? "chip-active" : "chip-idle"}`}
          >
            New pending loan
          </button>
          <button
            type="button"
            onClick={() => setUseNewEntity(false)}
            className={`chip ${!useNewEntity ? "chip-active" : "chip-idle"}`}
          >
            Existing
          </button>
        </div>

        {useNewEntity ? (
          <>
            <input
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.target.value)}
              placeholder="Pending loan name (defaults to rule name)"
              className="field text-sm"
            />
            <select
              value={entityCurrency}
              onChange={(e) => setEntityCurrency(e.target.value)}
              className="field text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        ) : (
          <select
            value={targetEntityId}
            onChange={(e) => setTargetEntityId(e.target.value)}
            className="field text-sm"
            required
          >
            <option value="">Select person/entity</option>
            {pendingLoans.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
        )}

        {error && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              color: "var(--color-red)",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.18)",
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary text-sm" disabled={saving}>
          {saving ? <LoadingLabel>Creating…</LoadingLabel> : "Create automation"}
        </button>
      </form>

      <div className="space-y-2">
        {loading ? (
          <SkeletonList count={3} />
        ) : automations.length === 0 ? (
          <p className="text-sm text-[var(--color-mist)]">
            No automations yet.
          </p>
        ) : (
          automations.map((a) => (
            <div key={a._id} className="list-row items-center">
              <div>
                <p className="font-medium text-[var(--color-paper)]">
                  {a.name} · {a.percentage}%
                </p>
                <p className="text-xs text-[var(--color-mist)]">
                  → {entityName(a.targetEntityId)}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => toggleActive(a)}
                  className={
                    a.active
                      ? "text-[var(--color-sage-bright)]"
                      : "text-[var(--color-mist)]"
                  }
                >
                  {a.active ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(a._id)}
                  style={{ color: "var(--color-red)" }}
                >
                  Del
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
