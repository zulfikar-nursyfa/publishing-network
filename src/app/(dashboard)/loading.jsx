export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-2">
        <div className="h-7 w-56 rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full rounded-md bg-muted/70" />
      </div>
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 rounded-lg bg-card" />
        ))}
      </div>
      <div className="space-y-3 rounded-lg bg-card p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-10 rounded-md bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
