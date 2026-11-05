"use client";
import { ChevronRight, Plus } from "lucide-react";
import { updateNetworkSettings, saveModelPrice } from "@/app/actions/network";
import { Field, cn, inputClass } from "@/components/ui";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";

export function NetworkSettingsForm({ settings }) {
  const [state, action] = useActionStateWithNotice(updateNetworkSettings, {});
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Default Gemini model"
          htmlFor="default-model"
          error={state.fieldErrors?.default_ai_model}
          hint="Used by every website without its own model. Leave empty for the deployment default."
        >
          <input
            id="default-model"
            name="default_ai_model"
            defaultValue={settings.default_ai_model ?? ""}
            className={cn(inputClass, "font-mono")}
            placeholder="gemini-3.8-flash"
          />
        </Field>
        <Field
          label="Network monthly AI limit"
          htmlFor="network-budget"
          error={state.fieldErrors?.monthly_ai_budget_usd}
          hint="Blank means no network limit; each website keeps its own. Zero stops new AI calls."
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <input
              id="network-budget"
              name="monthly_ai_budget_usd"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              defaultValue={settings.monthly_ai_budget_usd ?? ""}
              placeholder="No limit"
              className={cn(inputClass, "pr-24 pl-7 tabular-nums")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              USD / month
            </span>
          </div>
        </Field>
      </div>
      <div className="flex justify-end border-t pt-4">
        <SubmitButton>Save AI controls</SubmitButton>
      </div>
    </form>
  );
}

const PRICE_FIELDS = [
  {
    name: "input_per_million_usd",
    label: "Input price (USD per 1 million tokens)",
    hint: "What Google charges for the text we send: prompt, story and evidence. A token is about 4 characters, so 1 million tokens is roughly 750,000 words.",
  },
  {
    name: "output_per_million_usd",
    label: "Output price (USD per 1 million tokens)",
    hint: "What Google charges for what the model produces: the article text, its hidden reasoning (thinking), and for image models the image itself.",
  },
];

const usd = (value) => `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 6 })}`;

/** One model per row with its prices; the edit form opens below it. */
export function ModelPriceRow({ price }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        <span className="min-w-0 flex-1 break-all font-mono text-sm font-medium">{price.model}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>
            In <span className="font-medium text-foreground">{usd(price.input_per_million_usd)}</span> / 1M
          </span>
          <span>
            Out <span className="font-medium text-foreground">{usd(price.output_per_million_usd)}</span> / 1M
          </span>
          <span>
            Search <span className="font-medium text-foreground">{usd(price.search_per_thousand_usd)}</span> / 1K
          </span>
        </span>
      </summary>
      <div className="border-t bg-muted/20 p-4">
        <ModelPriceForm price={price} />
      </div>
    </details>
  );
}

export function NewModelPrice() {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <Plus aria-hidden className="size-4" />
        Add a model
      </summary>
      <div className="border-t bg-muted/20 p-4">
        <ModelPriceForm />
      </div>
    </details>
  );
}

function ModelPriceForm({ price }) {
  const [state, action] = useActionStateWithNotice(saveModelPrice, {});
  const id = price?.model ?? "new";
  return (
    <form action={action} className="space-y-3">
      {price ? (
        <input type="hidden" name="model" value={price.model} />
      ) : (
        <Field
          label="Model ID"
          htmlFor={`model-${id}`}
          error={state.fieldErrors?.model}
          hint="Exactly as Google names it, e.g. gemini-3.8-flash or gemini-3.1-flash-image."
        >
          <input id={`model-${id}`} name="model" required className={cn(inputClass, "font-mono")} />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {PRICE_FIELDS.map((field) => (
          <Field key={field.name} label={field.label} htmlFor={`${field.name}-${id}`} hint={field.hint}>
            <input
              id={`${field.name}-${id}`}
              name={field.name}
              required
              type="number"
              min="0"
              max="10000"
              step="0.000001"
              defaultValue={price?.[field.name] ?? ""}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
      <Field
        label="Web search price (USD per 1,000 searches)"
        htmlFor={`search-${id}`}
        hint="What Google charges when the model searches the web. Research uses this to find coverage of each story (up to 5 searches per story). Enter 0 for image models."
      >
        <input
          id={`search-${id}`}
          name="search_per_thousand_usd"
          required
          type="number"
          min="0"
          max="10000"
          step="0.000001"
          defaultValue={price?.search_per_thousand_usd ?? 35}
          className={inputClass}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary">{price ? "Update prices" : "Add model pricing"}</SubmitButton>
      </div>
    </form>
  );
}
