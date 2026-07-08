import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  formatMoney,
  type CurrencyBalance,
  type Entity,
  type EntityActivityItem,
} from "../api/client";
import { ActivityMonthSummary } from "../components/ActivityMonthSummary";
import { EntityBalanceLines } from "../components/EntityBalanceLines";
import { groupActivityByMonthAndDay } from "../lib/groupActivity";
import { LoanActivityItem } from "../components/LoanActivityItem";

export function EntityLoanDetailPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [activity, setActivity] = useState<EntityActivityItem[]>([]);
  const [balances, setBalances] = useState<CurrencyBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!entityId) return;
    setLoading(true);
    api
      .getEntityActivity(entityId)
      .then((data) => {
        setEntity(data.entity);
        setActivity(data.activity);
        const rows = data.summary.byCurrency.map((row) => {
          if ("balance" in row) {
            return { currency: row.currency, balance: row.balance };
          }
          return { currency: row.currency, balance: row.remaining };
        });
        setBalances(rows);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [entityId]);

  const months = useMemo(() => groupActivityByMonthAndDay(activity), [activity]);

  const activityTotals = useMemo(() => {
    const map = new Map<string, { added: number; paid: number }>();
    for (const item of activity) {
      if (!map.has(item.currency)) map.set(item.currency, { added: 0, paid: 0 });
      const bucket = map.get(item.currency)!;
      if (item.type === "add") bucket.added += item.amount;
      else bucket.paid += item.amount;
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [activity]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!entity) return <p className="text-sm text-zinc-500">Not found.</p>;

  const isPending = entity.direction === "i_owe";

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/loans")}
        className="mb-4 text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← Back to loans
      </button>

      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-lg font-semibold">{entity.name}</h1>
        <div className="text-right">
          <p className="mb-1 text-xs text-zinc-500">
            {isPending ? "Remaining" : "Owed to you"}
          </p>
          <EntityBalanceLines
            balances={balances}
            variant={isPending ? "owed" : "owedToYou"}
          />
        </div>
      </div>

      {activityTotals.length > 0 && (
        <div className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2.5">
          <p className="mb-2 text-sm font-semibold text-emerald-200">All time</p>
          <div className="space-y-2">
            {activityTotals.map(([c, { added, paid }]) => (
              <div key={c}>
                <p className="text-xs font-medium text-zinc-500">{c}</p>
                <div className="flex flex-wrap gap-x-4 text-sm">
                  <span className="text-rose-400">+{formatMoney(added, c)}</span>
                  <span className="text-emerald-400">-{formatMoney(paid, c)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {months.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="space-y-6">
          {months.map((month) => (
            <section key={month.key}>
              <ActivityMonthSummary title={month.label} byCurrency={month.byCurrency} />
              <div className="space-y-4">
                {month.days.map((day) => (
                  <div key={day.key}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {day.label}
                    </p>
                    <div className="space-y-2">
                      {day.items.map((item) => (
                        <LoanActivityItem key={item._id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
