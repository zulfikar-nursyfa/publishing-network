import Link from "next/link";
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Publishing Network</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in to the editorial dashboard.</p>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <LoginForm next={next} initialError={error} />
        </div>
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/auth/forgot-password" className="underline">Forgot your password?</Link>
        </p>
      </div>
    </main>
  );
}
