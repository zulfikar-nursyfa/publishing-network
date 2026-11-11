import { Tags } from "lucide-react";
import { setCategoryArchived, setCategoryAutoPublish } from "@/app/actions/categories";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, Card } from "@/components/ui";
import { CategoryForm, SyncCategoriesButton } from "./settings-forms";

function CategoryItem({ category, websiteId, isAdmin }) {
  return (
    <li className="p-3 text-sm sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {category.name}
            <span className="font-mono text-xs font-normal text-muted-foreground">{category.slug}</span>
            {category.wp_term_id ? null : <Badge tone="amber">not in WordPress</Badge>}
            {category.archived_at ? <Badge>archived</Badge> : null}
            {category.auto_publish_allowed ? <Badge tone="purple">auto-publish</Badge> : null}
          </div>
          {category.description ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{category.description}</div>
          ) : null}
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 gap-2">
            {!category.archived_at ? (
              <ActionForm
                action={setCategoryAutoPublish.bind(null, websiteId, category.id, !category.auto_publish_allowed)}
              >
                <SubmitButton
                  variant="secondary"
                  size="sm"
                  confirm={
                    category.auto_publish_allowed
                      ? undefined
                      : "Allow automated articles in this category to publish without review? It only applies when the website is in Automatic mode, and sensitive, uncorroborated or flagged drafts are still reviewed."
                  }
                  confirmLabel="Allow auto-publish"
                >
                  {category.auto_publish_allowed ? "Require review" : "Allow auto-publish"}
                </SubmitButton>
              </ActionForm>
            ) : null}
            <ActionForm action={setCategoryArchived.bind(null, websiteId, category.id, !category.archived_at)}>
              <SubmitButton
                variant="secondary"
                size="sm"
                confirm={
                  category.archived_at
                    ? undefined
                    : "Archive this category? Existing articles keep it, but it will no longer be offered for new articles."
                }
                confirmLabel="Archive"
              >
                {category.archived_at ? "Restore" : "Archive"}
              </SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </div>
      {isAdmin ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            Edit<span className="sr-only"> {category.name}</span>
          </summary>
          <div className="mt-2">
            <CategoryForm websiteId={websiteId} category={category} />
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function CategoriesCard({ websiteId, connected, categories, isAdmin, filtered = false }) {
  return (
    <Card
      icon={Tags}
      className="mb-6"
      title="Categories"
      description={
        connected
          ? "Editors and the AI choose from active categories. After applying niche categories, click Sync with WordPress to create them there by slug. Auto-publish is off until allowed here, and only applies in Automatic mode."
          : "Editors and the AI choose from active categories. They are created in WordPress automatically when the site is connected. Auto-publish is off until allowed here, and only applies in Automatic mode."
      }
    >
      {categories.length > 0 ? (
        <ul className="mb-5 divide-y rounded-lg border">
          {categories.map((category) => (
            <CategoryItem key={category.id} category={category} websiteId={websiteId} isAdmin={isAdmin} />
          ))}
        </ul>
      ) : (
        <p className="mb-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {filtered
            ? "No categories match these filters."
            : connected
              ? "No categories yet. Add one or sync with WordPress."
              : "No categories yet. Add one."}
        </p>
      )}
      {isAdmin ? (
        <div className="space-y-5">
          {connected ? <SyncCategoriesButton websiteId={websiteId} /> : null}
          <CategoryForm websiteId={websiteId} />
        </div>
      ) : null}
    </Card>
  );
}
