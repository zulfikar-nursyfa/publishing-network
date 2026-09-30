"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

export function NavLink({ href, children, exact = false }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-2 text-sm font-medium",
        active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100",
      )}
    >
      {children}
    </Link>
  );
}
