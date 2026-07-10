type SkeletonBlockProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function SkeletonBlock({ className = "", style }: SkeletonBlockProps) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

export function SkeletonList({ count = 3, subtitle = true }: { count?: number; subtitle?: boolean }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="list-row">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="block h-3.5" style={{ width: `${48 + (index % 3) * 12}%` }} />
            {subtitle && <SkeletonBlock className="block h-2.5 w-2/5" />}
          </div>
          <SkeletonBlock className="block h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonSummary({ rows = 2 }: { rows?: number }) {
  return (
    <div className="panel mb-3 px-4 py-3.5" aria-hidden="true">
      <SkeletonBlock className="mb-3 block h-2.5 w-24" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center justify-between">
            <SkeletonBlock className="block h-3 w-10" />
            <SkeletonBlock className="block h-4" style={{ width: index ? 82 : 104 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: fields }, (_, index) => (
        <SkeletonBlock key={index} className="block h-11 w-full rounded-xl" />
      ))}
      <SkeletonBlock className="block h-11 w-28 rounded-xl" />
    </div>
  );
}

export function SkeletonLedger() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((column) => (
          <div key={column} className="panel p-3">
            <SkeletonBlock className="mb-3 block h-2.5 w-16" />
            <div className="space-y-2">
              <SkeletonBlock className="block h-3 w-10" />
              <SkeletonBlock className="block h-4 w-4/5" />
              <SkeletonBlock className="block h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
      <div>
        <SkeletonBlock className="mb-2 block h-2.5 w-32" />
        <SkeletonList count={4} />
      </div>
    </div>
  );
}

export function SkeletonLoanDetail() {
  return (
    <div className="fade-up" aria-hidden="true">
      <SkeletonBlock className="mb-4 block h-9 w-32 rounded-xl" />
      <div className="mb-4 flex items-start justify-between">
        <SkeletonBlock className="block h-8 w-40" />
        <div className="space-y-2">
          <SkeletonBlock className="ml-auto block h-2.5 w-16" />
          <SkeletonBlock className="block h-4 w-24" />
        </div>
      </div>
      <div className="panel mb-4 p-3">
        <SkeletonBlock className="mb-3 block h-2.5 w-24" />
        <SkeletonForm fields={4} />
      </div>
      <SkeletonLedger />
    </div>
  );
}

export function AppLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <div className="loading-orbit" aria-hidden="true"><span /></div>
        <span className="section-label">Loading your ledger</span>
      </div>
    </div>
  );
}
