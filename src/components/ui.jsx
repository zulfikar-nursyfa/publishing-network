import Link from "next/link";

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, description, children, className, actions }) {
  return (
    <section className={cn("rounded-lg border border-gray-200 bg-white p-5 shadow-sm", className)}>
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-gray-600">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, href }) {
  const body = (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

const buttonVariants = {
  primary: "bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-400",
  secondary: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:text-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-300",
};

export function buttonClass(variant = "primary", className) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
    buttonVariants[variant],
    className,
  );
}

export function ButtonLink({ variant = "primary", className, ...props }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100";

export function Field({ label, htmlFor, hint, error, children, className }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-800">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

const badgeTones = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  purple: "bg-purple-50 text-purple-700",
};

export function Badge({ tone = "gray", children }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>;
}

const articleTone = {
  draft: "gray",
  in_review: "amber",
  approved: "blue",
  published: "green",
  unpublished: "gray",
  rejected: "red",
};

export function ArticleStatusBadge({ status }) {
  return <Badge tone={articleTone[status]}>{status.replace("_", " ")}</Badge>;
}

const publicationTone = {
  pending: "gray",
  in_progress: "purple",
  succeeded: "green",
  failed: "red",
};

export function PublicationStatusBadge({ status }) {
  return <Badge tone={publicationTone[status]}>publish {status.replace("_", " ")}</Badge>;
}

const connectionTone = { untested: "gray", ok: "green", failed: "red" };

export function ConnectionBadge({ status }) {
  const label = status === "ok" ? "connected" : status === "failed" ? "connection failed" : "not tested";
  return <Badge tone={connectionTone[status]}>{label}</Badge>;
}

export function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">{children}</div>;
}

export function Table({ children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }) {
  return <th className={cn("bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600", className)}>{children}</th>;
}

export function Td({ children, className }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}

export function formatDateTime(value, timeZone) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone || "UTC",
  }).format(new Date(value));
}
