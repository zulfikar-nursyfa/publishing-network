"use client";

import { updateNicheGuides } from "@/app/actions/niches";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { GuideEditor } from "./guide-editor";

const GUIDES = [
  ["en", "English websites", "Readers, angle, tone, and the accuracy rules for this topic.", "ltr"],
  ["ar", "Arabic websites", "Arabic or English; the article is always written in Arabic.", "auto"],
];

/** Editorial instructions added to the AI research, draft and fact-check prompts of the niche's websites. */
export function NicheGuideForm({ niche }) {
  const [state, action] = useActionStateWithNotice(updateNicheGuides.bind(null, niche.id), {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-5 xl:grid-cols-2">
        {GUIDES.map(([language, label, hint, dir]) => {
          const id = `${niche.id}-guide-${language}`;
          const error = errors[`guide_${language}`];
          return (
            <div key={language} className="min-w-0 space-y-1.5">
              <div id={id} className="text-sm font-medium">
                {label}
              </div>
              <GuideEditor
                name={`guide_${language}`}
                defaultValue={niche[`guide_${language}`] ?? ""}
                dir={dir}
                labelledBy={id}
                invalid={Boolean(error)}
                placeholder="Who the readers are, what to lead with, and what to avoid…"
              />
              <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{error ?? hint}</p>
            </div>
          );
        })}
      </div>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Save guides
      </SubmitButton>
    </form>
  );
}
