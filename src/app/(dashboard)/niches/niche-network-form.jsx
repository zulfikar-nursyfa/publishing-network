"use client";

import { moveNicheToNetwork } from "@/app/actions/niches";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { inputClass } from "@/components/ui";

/** The network whose shared rules the niche's websites follow. */
export function NicheNetworkForm({ niche, networks }) {
  const [state, action] = useActionStateWithNotice(moveNicheToNetwork.bind(null, niche.id), {});
  const id = `${niche.id}-network`;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium leading-none">
          Network
        </label>
        <select id={id} name="network_id" defaultValue={niche.network_id} className={inputClass}>
          {networks.map((network) => (
            <option key={network.id} value={network.id}>
              {network.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.network_id ? (
          <p className="text-xs text-destructive">{state.fieldErrors.network_id}</p>
        ) : null}
      </div>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Change network
      </SubmitButton>
    </form>
  );
}
