"use client";

import Link, { useLinkStatus } from "next/link";

function PendingMarker() {
  const { pending } = useLinkStatus();
  return <span data-list-link-pending={pending} hidden aria-hidden />;
}

export function ListLink({ children, ...props }) {
  return (
    <Link {...props}>
      {children}
      <PendingMarker />
    </Link>
  );
}
