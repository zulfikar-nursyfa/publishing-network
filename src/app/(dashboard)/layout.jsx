import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { NavLink } from "@/components/nav-link";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export default async function DashboardLayout({ children }) {
  const user = await requireUser();
  const appEnv = serverEnv().APP_ENV;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-gray-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link href="/" className="font-semibold tracking-tight">Publishing Network</Link>
          {appEnv !== "production" ? <Badge tone="amber">{appEnv}</Badge> : null}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
          <NavLink href="/" exact>Overview</NavLink>
          <NavLink href="/review">Review queue</NavLink>
          <NavLink href="/websites">Websites</NavLink>
          {user.isAdmin ? <NavLink href="/users">Users</NavLink> : null}
          <NavLink href="/activity">Activity</NavLink>
        </nav>
        <div className="hidden border-t border-gray-200 px-4 py-4 text-sm md:block">
          <div className="truncate font-medium">{user.profile.full_name || user.email}</div>
          <div className="text-xs text-gray-500">{user.isAdmin ? "Administrator" : "Editor"}</div>
          <div className="mt-3 flex gap-3 text-xs">
            <Link href="/account/password" className="text-gray-600 underline">Password</Link>
            <form action={signOut}>
              <button type="submit" className="text-gray-600 underline">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
