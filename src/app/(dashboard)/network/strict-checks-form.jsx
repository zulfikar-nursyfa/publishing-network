"use client";

import { useState } from "react";
import { updateStrictDraftChecks } from "@/app/actions/network";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Badge } from "@/components/ui";
import { DRAFT_CHECKS } from "@/lib/automation/strict-checks";

const GROUPS = [
  {
    title: "Sources",
    description: "Is the story backed by enough independent and official sources?",
    keys: ["sensitive_second_source", "single_unofficial_source", "official_source_not_cited", "uncollected_citations"],
  },
  {
    title: "Research",
    description: "Did the facts found during research make it into the draft?",
    keys: ["research_quotes_missing", "unresolved_claims", "research_not_cited"],
  },
  {
    title: "AI verification",
    description: "What the second AI pass said after reading the draft against its sources.",
    keys: ["verification_failed", "verification_issues", "unsupported_claims"],
  },
];
const RECOMMENDED = new Set(["sensitive_second_source", "official_source_not_cited"]);
const describe = new Map(DRAFT_CHECKS.map((check) => [check.key, check.description]));
// Any check not placed in a group above still shows, so a new check is never hidden.
const placed = new Set(GROUPS.flatMap((group) => group.keys));
const groups = [
  ...GROUPS.map((group) => ({ ...group, keys: group.keys.filter((key) => describe.has(key)) })),
  { title: "Other", description: null, keys: DRAFT_CHECKS.map((c) => c.key).filter((key) => !placed.has(key)) },
].filter((group) => group.keys.length);

export function StrictChecksForm({ checks }) {
  const [, action] = useActionStateWithNotice(updateStrictDraftChecks, {});
  const [on, setOn] = useState(() => new Set(checks));
  const dirty = on.size !== checks.length || checks.some((key) => !on.has(key));
  const toggle = (key, checked) =>
    setOn((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        A check that is on stops the draft and waits for a person to retry it. A check that is off still shows its
        warning to the reviewer.{" "}
        <span className="font-medium text-foreground">
          {on.size} of {DRAFT_CHECKS.length} blocking
        </span>
      </p>
      {groups.map((group) => (
        <fieldset key={group.title} className="min-w-0">
          <legend className="text-sm font-semibold">{group.title}</legend>
          {group.description ? <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p> : null}
          <div className="mt-2.5 divide-y rounded-lg border">
            {group.keys.map((key) => (
              <label
                key={key}
                className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0">
                  {describe.get(key)}
                  {RECOMMENDED.has(key) ? (
                    <Badge tone="green" className="ml-2 align-middle">
                      Recommended
                    </Badge>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  name="strict_draft_checks"
                  value={key}
                  checked={on.has(key)}
                  onChange={(event) => toggle(key, event.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
        <SubmitButton disabled={!dirty}>Save draft checks</SubmitButton>
      </div>
    </form>
  );
}
