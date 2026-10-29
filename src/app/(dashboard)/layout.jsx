import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export default async function DashboardLayout({ children }) {
  const user = await requireUser();
  const db = await createClient();
  // Not awaited: the sidebar badges stream in so they never delay the page.
  const attention = Promise.all([
    db.from("articles").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]).then(([review, failed]) => ({ "/review": review.count ?? 0, "/jobs": failed.count ?? 0 }));
  const appEnv = serverEnv().APP_ENV;

  return (
    <AppShell
      user={{ name: user.profile.full_name, email: user.email, isAdmin: user.isAdmin }}
      appEnv={appEnv}
      attention={attention}
    >
      {children}
    </AppShell>
  );
}
