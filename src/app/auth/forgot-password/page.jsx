"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [, action] = useActionStateWithNotice(requestPasswordReset, {});
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we will send you a link to choose a new password."
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      }
    >
      <form action={action} className="space-y-5">
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
        <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
