import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Globe, Newspaper, Search, Settings, Wrench } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { DOC_TOPICS } from "./topics";

export const metadata = { title: "Guide" };

const ICONS = {
  "Start here": Compass,
  "Adding a new website": Globe,
  "Stories and articles": Newspaper,
  "Settings and access": Settings,
  "Day-to-day operation": Wrench,
};

export default function DocsIndexPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Guide"
        description="How the Publishing Network works and how to run it, written for the whole team. No technical knowledge needed."
      />
      <p className="mb-6 flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <Search aria-hidden className="size-4 shrink-0" />
        <span>
          Looking for something specific? Press <kbd className="rounded border bg-card px-1.5 text-xs">Ctrl/⌘ K</kbd>{" "}
          and type a word to search every guide page.
        </span>
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {DOC_TOPICS.map((topic) => (
          <Card key={topic.title} icon={ICONS[topic.title] ?? BookOpen} title={topic.title} description={topic.description}>
            <ul className="-mx-2 space-y-0.5">
              {topic.pages.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="group flex items-center justify-between gap-4 rounded-md px-2 py-2.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>
                      <span className="block text-sm font-medium">{page.title}</span>
                      <span className="block text-sm text-muted-foreground">{page.summary}</span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
