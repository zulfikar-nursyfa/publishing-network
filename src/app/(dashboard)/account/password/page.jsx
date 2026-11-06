"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { setPassword } from "@/app/actions/auth";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Card, Field, PageHeader, buttonClass, cn, inputClass } from "@/components/ui";

const MIN = 10;

export default function PasswordPage() {
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [, action] = useActionStateWithNotice(async (previous, data) => {
    const result = await setPassword(previous, data);
    if (result?.ok) {
      setPasswordValue("");
      setConfirm("");
    }
    return result;
  }, {});
  const [shown, setShown] = useState(false);
  const longEnough = password.length >= MIN;
  const same = confirm.length > 0 && password === confirm;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Account" description="Manage how you sign in to the dashboard." />
      <Card icon={KeyRound} title="Change password" description={`Use at least ${MIN} characters.`}>
        <form action={action} className="space-y-5">
          <Field label="New password" htmlFor="password">
            <div className="relative">
              <input
                id="password"
                name="password"
                type={shown ? "text" : "password"}
                autoComplete="new-password"
                minLength={MIN}
                required
                value={password}
                onChange={(event) => setPasswordValue(event.target.value)}
                aria-describedby="password-rules"
                className={cn(inputClass, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShown(!shown)}
                aria-label={shown ? "Hide passwords" : "Show passwords"}
                aria-pressed={shown}
                className={buttonClass("ghost", "absolute inset-y-0 right-0 h-full rounded-l-none", "icon")}
              >
                {shown ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <input
              id="confirm"
              name="confirm"
              type={shown ? "text" : "password"}
              autoComplete="new-password"
              minLength={MIN}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-describedby="password-rules"
              className={inputClass}
            />
          </Field>
          <ul id="password-rules" aria-live="polite" className="space-y-1.5 text-sm">
            <Rule ok={longEnough}>
              At least {MIN} characters{password ? ` (${password.length})` : ""}
            </Rule>
            <Rule ok={same}>Both passwords match</Rule>
          </ul>
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…" disabled={!longEnough || !same}>
            Save password
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}

function Rule({ ok, children }) {
  const Icon = ok ? Check : X;
  return (
    <li
      className={cn("flex items-center gap-2", ok ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}
    >
      <Icon aria-hidden className="size-4" />
      {children}
      <span className="sr-only">{ok ? "(done)" : "(not yet)"}</span>
    </li>
  );
}
