import Link from "next/link";

export function WebsiteNav({ websiteId, active }) {
  const base = `/websites/${websiteId}`;
  return (
    <nav
      aria-label="Website sections"
      className="mb-6 flex min-w-0 max-w-full flex-wrap gap-1 rounded-lg border bg-card p-1"
    >
      {["overview", "articles", "schedule", "traffic", "costs", "settings"].map((key) => (
        <Link
          key={key}
          href={key === "settings" ? `${base}/settings` : `${base}?section=${key}`}
          aria-current={key === active ? "page" : undefined}
          className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium capitalize ${active === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {key}
        </Link>
      ))}
    </nav>
  );
}
