import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const error = params.error === "no-profile"
    ? "Your account has no dashboard profile. Ask an administrator to invite you again."
    : params.error === "link"
      ? "That link is invalid or has expired. Request a new one."
      : undefined;

  return (
    <AuthShell title="Welcome back" description="Sign in to the editorial dashboard.">
      <LoginForm next={next} initialError={error} />
    </AuthShell>
  );
}
