export function ListSkeleton() {
  return (
    <div className="space-y-4 motion-safe:animate-pulse" role="status" aria-label="Loading list" aria-busy="true">
      <div className="h-8 w-48 max-w-full rounded bg-muted" />
      <div className="h-11 rounded-lg bg-muted/40" />
      <div className="space-y-3 rounded-lg bg-card p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 rounded bg-muted/50" />
        ))}
      </div>
      <div className="h-9 w-56 max-w-full rounded bg-muted" />
    </div>
  );
}

/** Loading state for detail and settings pages: a header, a row of panels and a main column with a sidebar. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse" role="status" aria-label="Loading page" aria-busy="true">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-8 w-80 max-w-full rounded bg-muted" />
        <div className="h-4 w-64 max-w-full rounded bg-muted/60" />
      </div>
      <div className="h-11 rounded-lg bg-muted/40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="h-64 rounded-lg bg-card" />
          <div className="h-40 rounded-lg bg-card" />
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-lg bg-card" />
          <div className="h-32 rounded-lg bg-card" />
        </div>
      </div>
    </div>
  );
}
