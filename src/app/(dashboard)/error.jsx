"use client";

import Link from "next/link";
import { Alert, buttonClass } from "@/components/ui";

export default function DashboardError({ retry }) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Alert tone="error" title="This page could not be loaded">
        Try again. If this started after an update, ask an administrator to check the pending database migrations.
      </Alert>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass("primary")} onClick={() => retry()}>
          Try again
        </button>
        <Link href="/websites" className={buttonClass("secondary")}>
          Open websites
        </Link>
      </div>
    </div>
  );
}
