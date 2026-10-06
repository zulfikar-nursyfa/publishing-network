"use client";
import { useActionState } from "react";
import { updateNetworkSettings, saveModelPrice } from "@/app/actions/network";
import { Field, inputClass } from "@/components/ui";
import { FormAlert, SubmitButton } from "@/components/form-controls";

export function NetworkSettingsForm({ settings }) {
  const [state, action] = useActionState(updateNetworkSettings, {});
  return <form action={action} className="space-y-4">
    <FormAlert state={state} />
    <Field label="Default Gemini model" htmlFor="default-model" error={state.fieldErrors?.default_ai_model} hint="Leave empty to use the deployment default.">
      <input id="default-model" name="default_ai_model" defaultValue={settings.default_ai_model ?? ""} className={inputClass} placeholder="gemini-2.5-flash" />
    </Field>
    <Field label="Network monthly AI limit (USD)" htmlFor="network-budget" error={state.fieldErrors?.monthly_ai_budget_usd} hint="Blank means no network limit. Each website still has its own limit. Zero stops new AI calls.">
      <input id="network-budget" name="monthly_ai_budget_usd" type="number" min="0" max="100000" step="0.01" defaultValue={settings.monthly_ai_budget_usd ?? ""} className={inputClass} />
    </Field>
    <SubmitButton>Save network settings</SubmitButton>
  </form>;
}

export function ModelPriceForm({ price }) {
  const [state, action] = useActionState(saveModelPrice, {});
  return <form action={action} className="space-y-3 rounded-lg border p-4">
    <FormAlert state={state} />
    <Field label="Model ID" htmlFor={`model-${price?.model ?? "new"}`} error={state.fieldErrors?.model}>
      <input id={`model-${price?.model ?? "new"}`} name="model" required readOnly={Boolean(price)} defaultValue={price?.model ?? ""} className={inputClass} />
    </Field>
    <div className="grid gap-3 sm:grid-cols-2">
      {["input", "output"].map((kind) => <Field key={kind} label={`${kind === "input" ? "Input" : "Output (including thinking)"} USD / million tokens`} htmlFor={`${kind}-${price?.model ?? "new"}`}>
        <input id={`${kind}-${price?.model ?? "new"}`} name={`${kind}_per_million_usd`} required type="number" min="0" max="10000" step="0.000001" defaultValue={price?.[`${kind}_per_million_usd`] ?? ""} className={inputClass} />
      </Field>)}
    </div>
    <SubmitButton variant="secondary">{price ? "Update estimate" : "Add model pricing"}</SubmitButton>
  </form>;
}
