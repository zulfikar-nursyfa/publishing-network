"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export function LoginForm({ next, initialError }) {
  const [state, action] = useActionState(signIn, { error: initialError });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormAlert state={state} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
