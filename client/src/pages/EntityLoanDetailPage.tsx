import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  formatMoney,
  type Entity,
  type EntityActivityItem,
} from "../api/client";

import { groupByMonthAndDay } from "../lib/groupByDate";
import { LoanActivityItem } from "../components/LoanActivityItem";
import { FALLBACK_CURRENCY } from "../lib/currencies";

export function EntityLoanDetailPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [activity, setActivity] = useState<EntityActivityItem[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    api
      .getEntityActivity(entityId)
      .then((data) => {
        setEntity(data.entity);
        setActivity(data.activity);
        if ("remaining" in data.summary) setRemaining(data.summary.remaining);
        else if ("balance" in data.summary) setRemaining(data.summary.balance);
      })
      .finally(() => setLoading(false));
  }, [entityId]);

  const months = useMemo(() => groupByMonthAndDay(activity), [activity]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!entity) return <p className="text-sm text-zinc-500">Not found.</p>;

  const currency = entity.currency ?? FALLBACK_CURRENCY;
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
        <div>
          <h1 className="text-lg font-semibold">{entity.name}</h1>
          <p className="text-sm text-zinc-500">{currency}</p>
        </div>
        {remaining !== null && (
          <p
            className={`text-sm font-medium ${isPending ? "text-rose-300" : "text-emerald-300"}`}
          >
            {isPending ? "Remaining" : "Owed to you"}{" "}
            {formatMoney(remaining, currency)}
          </p>
        )}
      </div>

      {months.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="space-y-6">
          {months.map((month) => (
            <section key={month.key}>
              <p className="mb-3 text-sm font-semibold text-zinc-200">
                {month.label}
              </p>
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
