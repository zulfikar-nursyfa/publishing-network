import { CalendarClock, Globe, Newspaper, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Globe,
    title: "One dashboard, every site",
    text: "English and Arabic WordPress sites, each with its own schedule and editors.",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed before it ships",
    text: "Every article moves through draft, review and approval before publishing.",
  },
  {
    icon: CalendarClock,
    title: "Publishing on schedule",
    text: "Daily slots in each site's own timezone, with safe, idempotent retries.",
  },
];

export function AuthShell({ title, description, children, footer }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-card text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
            <Newspaper className="size-4.5" />
          </span>
          <span className="font-semibold tracking-tight">Publishing Network</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            The editorial control centre for the network.
          </h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{itemTitle}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Internal tool. Access is by invitation only.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
              <Newspaper className="size-4.5" />
            </span>
            <span className="font-semibold tracking-tight">Publishing Network</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
