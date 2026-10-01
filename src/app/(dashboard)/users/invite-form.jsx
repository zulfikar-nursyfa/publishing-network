"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { inviteUser } from "@/app/actions/users";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, checkboxClass, inputClass } from "@/components/ui";

export function InviteForm({ websites }) {
  const [state, action] = useActionState(inviteUser, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5">
      <FormAlert state={state} />
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Email" htmlFor="invite-email" error={errors.email}>
          <input id="invite-email" name="email" type="email" required className={inputClass} placeholder="name@company.com" />
        </Field>
        <Field label="Full name" htmlFor="invite-name" error={errors.full_name}>
          <input id="invite-name" name="full_name" className={inputClass} />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <select id="invite-role" name="role" defaultValue="editor" className={inputClass}>
            <option value="editor">Editor</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
      </div>
      {websites.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Websites <span className="font-normal text-muted-foreground">(editors only)</span></legend>
          <div className="flex flex-wrap gap-2">
            {websites.map((site) => (
              <label
                key={site.id}
                className="flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted has-checked:border-primary/40 has-checked:bg-accent has-checked:text-accent-foreground"
              >
                <input type="checkbox" name="website_ids" value={site.id} className={checkboxClass} />
                {site.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <SubmitButton pendingLabel="Sending…">
        <Send />
        Send invitation
      </SubmitButton>
    </form>
  );
}
