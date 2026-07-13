import { endOfMonth, startOfMonth } from "./groupTransactions";

export type RangeMode = "month" | "3m" | "6m" | "year" | "custom";

export const rangeOptions: Array<{ id: RangeMode; label: string }> = [
  { id: "month", label: "Month" },
  { id: "3m", label: "3 mo" },
  { id: "6m", label: "6 mo" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

export function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function getRange(
  mode: RangeMode,
  viewMonth: Date,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const now = new Date();
  switch (mode) {
    case "month":
      return { from: startOfMonth(viewMonth), to: endOfMonth(viewMonth) };
    case "3m":
      return { from: startOfMonth(shiftMonth(now, -2)), to: endOfMonth(now) };
    case "6m":
      return { from: startOfMonth(shiftMonth(now, -5)), to: endOfMonth(now) };
    case "year":
      return { from: startOfMonth(shiftMonth(now, -11)), to: endOfMonth(now) };
    case "custom":
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : startOfMonth(now),
        to: customTo ? new Date(`${customTo}T23:59:59.999`) : endOfMonth(now),
      };
  }
}

export function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(value: string): { from: Date; to: Date; label: string } {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return {
    from: startOfMonth(date),
    to: endOfMonth(date),
    label: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
  };
}
