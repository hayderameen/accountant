export function LoadingLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="button-spinner" aria-hidden="true" />
      {children}
    </span>
  );
}
