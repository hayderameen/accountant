import { useDataSync, type DataSyncStatus } from "../hooks/useDataSync";

const styles: Record<
  DataSyncStatus,
  { color: string; background: string; border: string }
> = {
  loading_live: {
    color: "#409cff",
    background: "rgba(10,132,255,0.14)",
    border: "rgba(10,132,255,0.28)",
  },
  live: {
    color: "#30d158",
    background: "rgba(48,209,88,0.1)",
    border: "rgba(48,209,88,0.22)",
  },
  saved: {
    color: "#ff9f0a",
    background: "rgba(255,159,10,0.1)",
    border: "rgba(255,159,10,0.22)",
  },
};

export function DataSyncStatusBar() {
  const { status, label } = useDataSync();
  const style = styles[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 mb-2.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
      style={{
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
      }}
    >
      {status === "loading_live" ? (
        <span className="button-spinner" aria-hidden style={{ width: 11, height: 11 }} />
      ) : (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: style.color,
            boxShadow: `0 0 8px ${style.color}`,
          }}
        />
      )}
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 650,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
