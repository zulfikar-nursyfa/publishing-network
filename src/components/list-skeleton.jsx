export function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-5" role="status" aria-label="Loading list" aria-busy="true">
      <div className="h-8 w-48 max-w-full rounded bg-muted" />
      <div className="h-24 rounded-xl border bg-muted/40" />
      <div className="space-y-3 rounded-xl border p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 rounded bg-muted/50" />
        ))}
      </div>
      <div className="h-9 w-56 max-w-full rounded bg-muted" />
    </div>
  );
}
