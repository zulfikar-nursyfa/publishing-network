"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { DOC_TOPICS } from "./topics";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Guide topics" className="space-y-5 text-sm">
      <Link
        href="/docs"
        className={cn("block font-medium", pathname === "/docs" ? "text-foreground" : "text-muted-foreground")}
      >
        All topics
      </Link>
      {DOC_TOPICS.map((topic) => (
        <div key={topic.title}>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{topic.title}</div>
          <ul className="space-y-0.5 border-l">
            {topic.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-ml-px block border-l py-1 pl-3 transition-colors",
                      active
                        ? "border-foreground font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
