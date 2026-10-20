"use client";

import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { RedirectNotice } from "@/components/action-notice";
import { Field, inputClass } from "@/components/ui";

export function LoginForm({ next, initialError }) {
  const [, action] = useActionStateWithNotice(signIn, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {initialError ? <RedirectNotice result={{ error: initialError }} params={["error"]} /> : null}
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={`${inputClass} h-10`}
          placeholder="you@company.com"
        />
      </Field>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium leading-none">
            Password
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${inputClass} h-10`}
        />
      </div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
