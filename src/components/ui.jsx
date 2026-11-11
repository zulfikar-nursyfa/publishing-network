import Link from "next/link";
import { ListLink } from "./list-link";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { humanLabel } from "@/lib/list-labels";

export function cn(...classes) {
  return twMerge(clsx(classes));
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 break-words">
        {back ? (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        ) : null}
        <h1 dir="auto" className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? <div className="mt-1.5 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2 sm:max-w-1/2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

/** Placeholder for a card that streams in behind <Suspense>. */
export function CardSkeleton({ className }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={cn("mb-8 h-48 rounded-lg bg-muted/40 motion-safe:animate-pulse", className)}
    />
  );
}

export function Card({ id, title, description, children, className, actions, icon: Icon }) {
  return (
    <section
      id={id}
      className={cn("min-w-0 scroll-mt-6 max-w-full rounded-lg bg-card p-4 text-card-foreground sm:p-5", className)}
    >
      {title ? (
        <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="mt-1 flex shrink-0 items-center justify-center text-muted-foreground">
                <Icon className="size-4" />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[0.95rem] font-semibold leading-6">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex max-w-full flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SectionHeading({ title, description, actions }) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, hint, href, alert = false }) {
  const body = (
    <div className="h-full min-w-0 bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-medium tracking-tight tabular-nums", alert && "text-destructive")}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block h-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-65 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85",
        secondary: "border bg-card text-foreground hover:bg-muted active:bg-muted/80",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30",
        "danger-outline": "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10",
        success: "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/30",
      },
      size: {
        default: "h-11 px-4 sm:h-9",
        sm: "h-11 gap-1.5 sm:h-8 rounded-md px-3 text-[0.8rem]",
        lg: "h-10 px-5",
        icon: "size-11 sm:size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function buttonClass(variant = "primary", className, size = "default") {
  return cn(buttonVariants({ variant, size }), className);
}

export function ButtonLink({ variant = "primary", size = "default", className, ...props }) {
  return <Link className={buttonClass(variant, className, size)} {...props} />;
}

export const inputClass =
  "block w-full max-w-full min-w-0 min-h-11 sm:min-h-9 rounded-md border border-input bg-card px-3 py-1.5 text-base sm:text-sm outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-80";

export const checkboxClass =
  "size-4 shrink-0 rounded border-input outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function RowCheckbox(props) {
  return (
    <label className="inline-flex size-11 cursor-pointer items-center justify-center sm:size-6">
      <input {...props} type="checkbox" className={checkboxClass} />
    </label>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium leading-none">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
          <CircleAlert className="size-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function CheckboxLabel({ children, className, ...props }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/60 has-checked:border-primary/40 has-checked:bg-accent/60",
        className,
      )}
    >
      <input type="checkbox" className={checkboxClass} {...props} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

const alertTones = {
  success: {
    className: "border-emerald-500/25 bg-emerald-500/8 text-emerald-800 dark:text-emerald-300",
    icon: CircleCheck,
  },
  warning: { className: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200", icon: TriangleAlert },
  error: { className: "border-red-500/25 bg-red-500/8 text-red-800 dark:text-red-300", icon: CircleAlert },
  info: { className: "border-border bg-muted/60 text-foreground", icon: Info },
};

export function Alert({ tone = "info", title, children, className, role }) {
  const { className: toneClass, icon: Icon } = alertTones[tone];
  return (
    <div
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title ? <div className="font-medium">{title}</div> : null}
        <div className={cn("break-words", title && "opacity-90")}>{children}</div>
      </div>
    </div>
  );
}

const badgeTones = {
  gray: "border-border bg-muted text-muted-foreground",
  blue: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  purple: "border-border bg-muted text-muted-foreground",
};

const dotTones = {
  gray: "bg-muted-foreground/60",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  purple: "bg-muted-foreground",
};

export function Badge({ tone = "gray", dot = false, children, className }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium leading-5",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotTones[tone])} /> : null}
      {typeof children === "string" ? humanLabel(children) : children}
    </span>
  );
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
  return (
    <Badge tone={articleTone[status]} dot>
      {status.replace("_", " ")}
    </Badge>
  );
}

const publicationTone = {
  pending: "gray",
  in_progress: "purple",
  succeeded: "green",
  failed: "red",
};

export function PublicationStatusBadge({ status }) {
  return (
    <Badge tone={publicationTone[status]} dot>
      publish {status.replace("_", " ")}
    </Badge>
  );
}

const connectionTone = { none: "gray", untested: "gray", ok: "green", failed: "red" };
const connectionLabel = { none: "not connected", untested: "not tested", ok: "connected", failed: "connection failed" };

/** Needs the website's wp_base_url and wp_connection_status. */
export function ConnectionBadge({ website }) {
  const status = website.wp_base_url ? website.wp_connection_status : "none";
  const label = connectionLabel[status];
  return (
    <Badge tone={connectionTone[status]} dot>
      {label}
    </Badge>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center rounded-lg bg-card px-5 py-8 text-center", className)}
    >
      {Icon ? (
        <div className="mb-3 flex items-center justify-center text-muted-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      {title ? <div className="mb-1 font-medium">{title}</div> : null}
      <div className="max-w-sm text-sm text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
        {children}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Table({ children, className }) {
  return (
    <div className={cn("data-table min-w-0 max-w-full overflow-x-auto rounded-lg bg-card", className)}>
      <table className="min-w-full text-sm tabular-nums [&_tbody_tr]:border-t [&_tbody_tr]:border-border/60 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/30 [&_tbody_tr:has(input:checked)]:bg-muted">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, ...props }) {
  return (
    <th
      scope="col"
      {...props}
      className={cn(
        "h-10 whitespace-nowrap bg-card px-4 text-left align-middle text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

/** Underlined-on-hover link for primary cells and inline references. */
export const linkClass = "font-medium text-foreground underline-offset-4 hover:text-primary hover:underline";

export function FilterTabs({ items, active }) {
  return (
    <div className="mb-4 min-w-0 max-w-full overflow-x-auto">
      <nav className="flex w-max min-w-full items-center gap-4 border-b">
        {items.map((item) => (
          <ListLink
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-1 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === item.key ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {humanLabel(item.label)}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active === item.key ? "bg-accent text-accent-foreground" : "bg-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </ListLink>
        ))}
      </nav>
    </div>
  );
}

export function DescriptionList({ items, className }) {
  return (
    <dl className={cn("divide-y text-sm", className)}>
      {items.map((item) => (
        <div
          key={humanLabel(item.label)}
          className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-4"
        >
          <dt className="shrink-0 text-muted-foreground">{humanLabel(item.label)}</dt>
          <dd className="min-w-0 break-words sm:text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function initials(name) {
  const parts = String(name ?? "")
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, className }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function formatDateTime(value, timeZone) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone || "UTC",
  }).format(new Date(value));
}
