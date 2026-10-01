import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export default async function DashboardLayout({ children }) {
  const user = await requireUser();
  const appEnv = serverEnv().APP_ENV;

  return (
    <AppShell
      user={{ name: user.profile.full_name, email: user.email, isAdmin: user.isAdmin }}
      appEnv={appEnv}
    >
      {children}
    </AppShell>
  );
}
