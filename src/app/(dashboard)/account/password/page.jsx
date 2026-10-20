"use client";

import { KeyRound } from "lucide-react";
import { setPassword } from "@/app/actions/auth";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";

export default function PasswordPage() {
  const [, action] = useActionStateWithNotice(setPassword, {});
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Account" description="Manage how you sign in to the dashboard." />
      <Card icon={KeyRound} title="Change password" description="Use at least 10 characters.">
        <form action={action} className="space-y-5">
          <Field label="New password" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className={inputClass}
            />
          </Field>
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
            Save password
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
