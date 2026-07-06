import { useEffect, useState, type FormEvent } from "react";
import { api, type Automation, type Entity } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { CURRENCIES, FALLBACK_CURRENCY } from "../lib/currencies";

export function AutomationsPage() {
  const { user } = useAuth();
  const defaultCurrency = user?.settings?.defaultCurrency ?? FALLBACK_CURRENCY;
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [pendingLoans, setPendingLoans] = useState<Entity[]>([]);
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const [useNewEntity, setUseNewEntity] = useState(true);
  const [newEntityName, setNewEntityName] = useState("");
  const [entityCurrency, setEntityCurrency] = useState(defaultCurrency);
  const [targetEntityId, setTargetEntityId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [auto, entities] = await Promise.all([
      api.getAutomations(),
      api.getEntities("i_owe"),
    ]);
    setAutomations(auto);
    setPendingLoans(entities);
  };

  useEffect(() => {
    setEntityCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    load();
  }, []);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const toggleActive = async (a: Automation) => {
    await api.updateAutomation(a._id, { active: !a.active });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    await api.deleteAutomation(id);
    await load();
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Automations</h1>
      <p className="mb-4 text-sm text-zinc-400">
        On each income, create a pending loan obligation as a % of that income.
      </p>

      <form
        onSubmit={onSubmit}
        className="mb-6 space-y-3 rounded-lg bg-zinc-900 p-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name e.g. Charity 10%"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="100"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          placeholder="Percentage of income"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />

        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setUseNewEntity(true)}
            className={`flex-1 rounded py-1.5 ${useNewEntity ? "bg-emerald-600" : "bg-zinc-800"}`}
          >
            New pending loan
          </button>
          <button
            type="button"
            onClick={() => setUseNewEntity(false)}
            className={`flex-1 rounded py-1.5 ${!useNewEntity ? "bg-emerald-600" : "bg-zinc-800"}`}
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
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <select
              value={entityCurrency}
              onChange={(e) => setEntityCurrency(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            required
          >
            <option value="">Select pending loan</option>
            {pendingLoans.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          className="w-full rounded bg-emerald-600 py-2 text-sm font-medium"
        >
          Create automation
        </button>
      </form>

      <div className="space-y-2">
        {automations.length === 0 ? (
          <p className="text-sm text-zinc-500">No automations yet.</p>
        ) : (
          automations.map((a) => (
            <div
              key={a._id}
              className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2.5"
            >
              <div>
                <p className="font-medium">
                  {a.name} · {a.percentage}%
                </p>
                <p className="text-xs text-zinc-500">
                  → {entityName(a.targetEntityId)}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => toggleActive(a)}
                  className={a.active ? "text-emerald-400" : "text-zinc-500"}
                >
                  {a.active ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(a._id)}
                  className="text-red-400"
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
