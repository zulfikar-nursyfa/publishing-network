"use client";
import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { sendTestAlert, updateAlertEmails } from "@/app/actions/network";
import { alertRecipient, MAX_ALERT_RECIPIENTS } from "@/lib/alert-recipients";
import { Field, inputClass, buttonClass } from "@/components/ui";
import { FormAlert, SubmitButton } from "@/components/form-controls";

export function AlertEmailsForm({ emails }) {
  const [state, action] = useActionState(updateAlertEmails, {});
  const [testState, testAction] = useActionState(sendTestAlert, {});
  const [recipients, setRecipients] = useState(emails);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const saved = state.emails ?? emails;
  const dirty = recipients.join("\n") !== saved.join("\n");
  function add(event) {
    event.preventDefault();
    const parsed = alertRecipient.safeParse(email.trim());
    if (!parsed.success) return setError("Enter a valid email address.");
    if (recipients.some((item) => item.toLowerCase() === parsed.data))
      return setError("This recipient is already on the list.");
    if (recipients.length >= MAX_ALERT_RECIPIENTS) return setError("You can save up to 10 recipients.");
    setRecipients([...recipients, parsed.data]);
    setEmail("");
    setError("");
  }
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.65fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <h3 className="font-medium">Alert recipients</h3>
          <span className="text-xs text-muted-foreground">
            {recipients.length} / 10{dirty ? " · Unsaved" : ""}
          </span>
        </div>
        {recipients.length ? (
          <ul className="divide-y rounded-lg bg-muted/40 px-3">
            {recipients.map((recipient) => (
              <li key={recipient} className="flex min-w-0 items-center justify-between gap-2 py-1">
                <span className="min-w-0 break-all text-sm">{recipient}</span>
                <button
                  type="button"
                  aria-label={`Remove ${recipient}`}
                  className={buttonClass("ghost", "", "icon")}
                  onClick={() => {
                    setRecipients(recipients.filter((item) => item !== recipient));
                    setError("");
                  }}
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            {dirty ? "No recipients selected. Save to turn alert emails off." : "No recipients — alert emails are off"}
          </p>
        )}
        <form onSubmit={add} noValidate className="flex min-w-0 items-end gap-2">
          <Field label="Add email" htmlFor="add-alert-email" className="min-w-0 flex-1">
            <input
              id="add-alert-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="editor@publisher.example"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "recipient-error" : undefined}
            />
          </Field>
          <button type="submit" className={buttonClass("secondary")}>
            Add
          </button>
        </form>
        {error ? (
          <p id="recipient-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <form action={action} className="space-y-3">
          <input type="hidden" name="alert_emails" value={recipients.join("\n")} />
          <FormAlert state={state} />
          <SubmitButton disabled={!dirty}>Save recipients</SubmitButton>
        </form>
      </div>
      <div className="min-w-0 space-y-3 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
        <h3 className="text-sm font-medium">Test delivery</h3>
        <p className="break-words text-xs leading-relaxed text-muted-foreground">
          {dirty
            ? "Save recipient changes before sending a test."
            : saved.length
              ? `Sends to ${saved.join(", ")}.`
              : "Add and save a recipient to send a test."}
        </p>
        <form action={testAction} className="space-y-3">
          <FormAlert state={testState} />
          <SubmitButton variant="secondary" disabled={dirty || !saved.length}>
            Send test email
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
