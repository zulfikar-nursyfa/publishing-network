"use client";

import { addNetwork, updateNetwork } from "@/app/actions/networks";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";
import { NETWORK_KINDS } from "@/lib/validation";
import { GuideEditor } from "./guide-editor";

const RULES = [
  ["en", "Shared rules for English websites", "ltr"],
  ["ar", "Shared rules for Arabic websites", "auto"],
];

/** Adds a network, or edits one when `network` is given. Its rules go into every niche's AI prompts above the niche guide. */
export function NetworkForm({ network }) {
  const [state, action] = useActionStateWithNotice(network ? updateNetwork.bind(null, network.id) : addNetwork, {});
  const errors = state.fieldErrors ?? {};
  const prefix = network?.id ?? "new-network";
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${prefix}-name`} error={errors.name}>
          <input
            id={`${prefix}-name`}
            name="name"
            required
            defaultValue={network?.name ?? ""}
            className={inputClass}
            placeholder="e.g. Health"
          />
        </Field>
        <Field
          label="Type"
          htmlFor={`${prefix}-kind`}
          error={errors.kind}
          hint="Chooses network-specific drafting behaviour."
        >
          <select id={`${prefix}-kind`} name="kind" defaultValue={network?.kind ?? "general"} className={inputClass}>
            {Object.entries(NETWORK_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {RULES.map(([language, label, dir]) => {
          const id = `${prefix}-rules-${language}`;
          const error = errors[`rules_${language}`];
          return (
            <div key={language} className="min-w-0 space-y-1.5">
              <div id={id} className="text-sm font-medium">
                {label}
              </div>
              <GuideEditor
                name={`rules_${language}`}
                defaultValue={network?.[`rules_${language}`] ?? ""}
                dir={dir}
                labelledBy={id}
                invalid={Boolean(error)}
                maxLength={16000}
                placeholder="Rules every website in this network follows, such as sourcing and review rules…"
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          );
        })}
      </div>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        {network ? "Save network" : "Add network"}
      </SubmitButton>
    </form>
  );
}
