import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { DOC_TOPICS } from "./topics";

export const metadata = { title: "Guide" };

export default function DocsIndexPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Guide"
        description="How the Publishing Network works and how to run it, written for the whole team. No technical knowledge needed."
      />
      <div className="space-y-6">
        {DOC_TOPICS.map((topic) => (
          <Card key={topic.title} title={topic.title} description={topic.description}>
            <ul className="divide-y">
              {topic.pages.map((page) => (
                <li key={page.href}>
                  <Link href={page.href} className="group flex items-center justify-between gap-4 py-3">
                    <span>
                      <span className="block text-sm font-medium group-hover:underline">{page.title}</span>
                      <span className="block text-sm text-muted-foreground">{page.summary}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
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
