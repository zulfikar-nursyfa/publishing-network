"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/actions/auth";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";

export default function PasswordPage() {
  const [state, action] = useActionState(setPassword, {});
  return (
    <div className="max-w-md">
      <PageHeader title="Password" description="Choose a password of at least 10 characters." />
      <Card>
        <form action={action} className="space-y-4">
          <FormAlert state={state} />
          <Field label="New password" htmlFor="password">
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
          </Field>
          <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
