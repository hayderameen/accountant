import type { StatsGroupBy } from "../api/client";
import {
  rangeOptions,
  shiftMonth,
  type RangeMode,
} from "../lib/dateRange";

type Props = {
  rangeMode: RangeMode;
  onRangeModeChange: (mode: RangeMode) => void;
  viewMonth: Date;
  onViewMonthChange: (date: Date) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  groupBy?: StatsGroupBy;
  onGroupByChange?: (value: StatsGroupBy) => void;
};

export function PeriodSelector({
  rangeMode,
  onRangeModeChange,
  viewMonth,
  onViewMonthChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  groupBy,
  onGroupByChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {rangeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onRangeModeChange(option.id)}
            className={`chip ${
              rangeMode === option.id ? "chip-active" : "chip-idle"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {rangeMode === "month" && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onViewMonthChange(shiftMonth(viewMonth, -1))}
            className="btn-ghost"
          >
            ← Prev
          </button>
          <span className="text-paper text-sm font-medium">
            {viewMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            type="button"
            onClick={() => onViewMonthChange(shiftMonth(viewMonth, 1))}
            className="btn-ghost"
          >
            Next →
          </button>
        </div>
      )}

      {rangeMode === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(event) => onCustomFromChange(event.target.value)}
            className="field text-sm"
          />
          <input
            type="date"
            value={customTo}
            onChange={(event) => onCustomToChange(event.target.value)}
            className="field text-sm"
          />
        </div>
      )}

      {groupBy && onGroupByChange && (
        <div>
          <p className="section-label mb-2">Group graph by</p>
          <div className="flex gap-2">
            {(["day", "week", "month"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onGroupByChange(value)}
                className={`chip capitalize ${
                  groupBy === value ? "chip-active" : "chip-idle"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
