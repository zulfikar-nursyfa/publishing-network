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
      <input id="default-model" name="default_ai_model" defaultValue={settings.default_ai_model ?? ""} className={inputClass} placeholder="gemini-3.8-flash" />
    </Field>
    <Field label="Network monthly AI limit (USD)" htmlFor="network-budget" error={state.fieldErrors?.monthly_ai_budget_usd} hint="Blank means no network limit. Each website still has its own limit. Zero stops new AI calls.">
      <input id="network-budget" name="monthly_ai_budget_usd" type="number" min="0" max="100000" step="0.01" defaultValue={settings.monthly_ai_budget_usd ?? ""} className={inputClass} />
    </Field>
    <SubmitButton>Save network settings</SubmitButton>
  </form>;
}

const PRICE_FIELDS = [
  { name: "input_per_million_usd", label: "Input price (USD per 1 million tokens)",
    hint: "What Google charges for the text we send: prompt, story and evidence. A token is about 4 characters, so 1 million tokens is roughly 750,000 words." },
  { name: "output_per_million_usd", label: "Output price (USD per 1 million tokens)",
    hint: "What Google charges for what the model produces: the article text, its hidden reasoning (thinking), and for image models the image itself." },
];

export function ModelPriceForm({ price }) {
  const [state, action] = useActionState(saveModelPrice, {});
  const id = price?.model ?? "new";
  return <form action={action} className="space-y-3 rounded-lg border p-4">
    <FormAlert state={state} />
    <Field label="Model ID" htmlFor={`model-${id}`} error={state.fieldErrors?.model} hint={price ? undefined : "Exactly as Google names it, e.g. gemini-3.8-flash or gemini-3.1-flash-image."}>
      <input id={`model-${id}`} name="model" required readOnly={Boolean(price)} defaultValue={price?.model ?? ""} className={inputClass} />
    </Field>
    <div className="grid gap-3 sm:grid-cols-2">
      {PRICE_FIELDS.map((field) => <Field key={field.name} label={field.label} htmlFor={`${field.name}-${id}`} hint={field.hint}>
        <input id={`${field.name}-${id}`} name={field.name} required type="number" min="0" max="10000" step="0.000001" defaultValue={price?.[field.name] ?? ""} className={inputClass} />
      </Field>)}
    </div>
    <Field label="Web search price (USD per 1,000 searches)" htmlFor={`search-${id}`}
      hint="What Google charges when the model searches the web. Research uses this to find coverage of each story (up to 5 searches per story). Enter 0 for image models.">
      <input id={`search-${id}`} name="search_per_thousand_usd" required type="number" min="0" max="10000" step="0.000001" defaultValue={price?.search_per_thousand_usd ?? 35} className={inputClass} />
    </Field>
    <SubmitButton variant="secondary">{price ? "Update estimate" : "Add model pricing"}</SubmitButton>
  </form>;
}
