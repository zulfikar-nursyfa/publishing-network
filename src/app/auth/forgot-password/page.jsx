"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, {});
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="mb-6 text-sm text-gray-600">We will email you a link to choose a new password.</p>
        <form action={action} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <FormAlert state={state} />
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="underline">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
