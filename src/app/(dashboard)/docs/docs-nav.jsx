"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { DOC_TOPICS } from "./topics";

export function DocsNav() {
  const pathname = usePathname();
  const mobileMenu = useRef(null);
  const topics = (
    <>
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
    </>
  );
  return (
    <>
      <details ref={mobileMenu} className="lg:hidden" key={pathname}>
        <summary className="cursor-pointer rounded-md border bg-card px-3 py-2 text-sm font-medium">
          Guide topics
        </summary>
        <nav
          aria-label="Guide topics"
          className="mt-4 space-y-5 text-sm"
          onClick={(event) => {
            if (event.target.closest("a")) mobileMenu.current.open = false;
          }}
        >
          {topics}
        </nav>
      </details>
      <nav aria-label="Guide topics" className="hidden space-y-5 text-sm lg:block">
        {topics}
      </nav>
    </>
  );
}
