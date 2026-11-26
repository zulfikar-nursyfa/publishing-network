"use client";

import { Plus } from "lucide-react";
import { addNiche } from "@/app/actions/niches";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export function AddNicheForm({ networks }) {
  const [state, action] = useActionStateWithNotice(addNiche, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="niche-name" error={state.fieldErrors?.name}>
          <input id="niche-name" name="name" required className={inputClass} placeholder="e.g. Cardiology" />
        </Field>
        <Field label="Network" htmlFor="niche-network" error={state.fieldErrors?.network_id}>
          <select id="niche-network" name="network_id" required className={inputClass}>
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        <Plus />
        Add niche
      </SubmitButton>
    </form>
  );
}
