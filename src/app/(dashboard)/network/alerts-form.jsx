"use client";
import { useActionState } from "react";
import { sendTestAlert, updateAlertEmails } from "@/app/actions/network";
import { Field, inputClass } from "@/components/ui";
import { FormAlert, SubmitButton } from "@/components/form-controls";

export function AlertEmailsForm({ emails }) {
  const [state, action] = useActionState(updateAlertEmails, {});
  const [testState, testAction] = useActionState(sendTestAlert, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <FormAlert state={state} />
        <Field
          label="Alert recipients"
          htmlFor="alert-emails"
          error={state.fieldErrors?.alert_emails}
          hint="One email address per line, up to 10. Leave empty to turn alert emails off."
        >
          <textarea
            id="alert-emails"
            name="alert_emails"
            rows={3}
            defaultValue={emails.join("\n")}
            className={inputClass}
            placeholder="tech@example.com"
          />
        </Field>
        <SubmitButton>Save recipients</SubmitButton>
      </form>
      <form action={testAction} className="space-y-3">
        <FormAlert state={testState} />
        <SubmitButton variant="secondary">Send test email</SubmitButton>
      </form>
    </div>
  );
}
