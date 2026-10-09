import Link from "next/link";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { twMerge } from "tailwind-merge";

export function cn(...classes) {
  return twMerge(clsx(classes));
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
        {description ? <div className="mt-1.5 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, description, children, className, actions, icon: Icon }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 text-card-foreground shadow-xs sm:p-6", className)}>
      {title ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[0.95rem] font-semibold leading-6">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SectionHeading({ title, description, actions }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

const statTones = {
  default: "bg-accent text-accent-foreground",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export function Stat({ label, value, hint, href, icon: Icon, tone = "default", alert = false }) {
  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all sm:p-5",
        href && "hover:-translate-y-px hover:border-primary/30 hover:shadow-md",
        alert && "border-red-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[0.8rem] font-medium text-muted-foreground">{label}</div>
        {Icon ? (
          <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", statTones[tone])}>
            <Icon className="size-4" />
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
          alert && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85",
        secondary: "border bg-card text-foreground shadow-xs hover:bg-muted active:bg-muted/80",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/30",
        "danger-outline": "border border-destructive/30 bg-card text-destructive shadow-xs hover:bg-destructive/10",
        success: "bg-success text-success-foreground shadow-xs hover:bg-success/90 focus-visible:ring-success/30",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8rem]",
        lg: "h-10 px-5",
        icon: "size-9",
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
  "block w-full min-w-0 min-h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-80";

export const checkboxClass = "size-4 shrink-0 rounded border-input";

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
  purple: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const dotTones = {
  gray: "bg-muted-foreground/60",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  purple: "bg-violet-500",
};

export function Badge({ tone = "gray", dot = false, children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium capitalize leading-5",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotTones[tone])} /> : null}
      {children}
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

const connectionTone = { untested: "gray", ok: "green", failed: "red" };

export function ConnectionBadge({ status }) {
  const label = status === "ok" ? "connected" : status === "failed" ? "connection failed" : "not tested";
  return (
    <Badge tone={connectionTone[status]} dot>
      {label}
    </Badge>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
    <div className={cn("overflow-x-auto rounded-xl border bg-card shadow-xs", className)}>
      <table className="min-w-full text-sm [&_tbody_tr]:border-t [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/40">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap bg-muted/40 px-4 text-left align-middle text-xs font-medium text-muted-foreground",
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
    <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <nav className="inline-flex min-w-max items-center gap-1 rounded-lg border bg-muted/50 p-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              active === item.key
                ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
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
          </Link>
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
          key={item.label}
          className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-4"
        >
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
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
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-violet-500/80 text-xs font-semibold text-white",
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
