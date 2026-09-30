"use client";

import { useActionState } from "react";
import { inviteUser } from "@/app/actions/users";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export function InviteForm({ websites }) {
  const [state, action] = useActionState(inviteUser, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Email" htmlFor="invite-email" error={errors.email}>
          <input id="invite-email" name="email" type="email" required className={inputClass} />
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
          <legend className="mb-1 text-sm font-medium text-gray-800">Websites (editors only)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {websites.map((site) => (
              <label key={site.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="website_ids" value={site.id} className="h-4 w-4" />
                {site.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
    </form>
  );
}
