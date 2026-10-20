import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Alert, PageHeader } from "@/components/ui";
import { DOC_TOPICS } from "./topics";

/** Small building blocks for the guide pages, so each page is mostly plain text. */

export function DocPage({ href, title, description, children }) {
  return (
    <article className="max-w-3xl">
      <PageHeader title={title} description={description} />
      <div className="space-y-8 text-sm leading-relaxed">{children}</div>
      <PageNav href={href} />
    </article>
  );
}

export function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Numbered steps. Each child should be a <Step>. */
export function Steps({ children }) {
  return <ol className="space-y-4 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }) {
  return (
    <li className="relative pl-10 [counter-increment:step] before:absolute before:left-0 before:top-0 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:bg-muted before:text-xs before:font-semibold before:content-[counter(step)]">
      <div className="pt-0.5 font-medium">{title}</div>
      {children ? <div className="mt-1.5 space-y-2 text-muted-foreground">{children}</div> : null}
    </li>
  );
}

export function List({ children }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/** A menu path to click through, e.g. <Path>Users → Profile</Path>. */
export function Path({ children }) {
  return <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{children}</span>;
}

/** Text to copy exactly: a value, address or file name. */
export function Code({ children }) {
  return <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}

export function Note({ tone = "info", title, children }) {
  return (
    <Alert tone={tone} title={title}>
      {children}
    </Alert>
  );
}

export function DocLink({ href, children }) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      className="font-medium text-foreground underline underline-offset-4"
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}

/** Previous / next links, in the order of topics.js. */
function PageNav({ href }) {
  const pages = DOC_TOPICS.flatMap((topic) => topic.pages);
  const index = pages.findIndex((page) => page.href === href);
  const prev = pages[index - 1];
  const next = pages[index + 1];
  return (
    <nav className="mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between">
      {prev ? (
        <Link href={prev.href} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="flex items-center gap-2 text-sm font-medium hover:underline">
          {next.title} <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
