import { Tags } from "lucide-react";
import { setCategoryArchived } from "@/app/actions/categories";
import { SubmitButton } from "@/components/form-controls";
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
          </div>
          {category.description ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{category.description}</div>
          ) : null}
        </div>
        {isAdmin ? (
          <form
            action={setCategoryArchived.bind(null, websiteId, category.id, !category.archived_at)}
            className="shrink-0"
          >
            <SubmitButton variant="secondary" size="sm">
              {category.archived_at ? "Restore" : "Archive"}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {isAdmin ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-primary">Edit</summary>
          <div className="mt-2">
            <CategoryForm websiteId={websiteId} category={category} />
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function CategoriesCard({ websiteId, categories, isAdmin }) {
  return (
    <Card
      icon={Tags}
      className="mb-6"
      title="Categories"
      description="Editors and the AI choose from active categories. Each one is linked to a WordPress category of the same slug."
    >
      {categories.length > 0 ? (
        <ul className="mb-5 divide-y rounded-lg border">
          {categories.map((category) => (
            <CategoryItem key={category.id} category={category} websiteId={websiteId} isAdmin={isAdmin} />
          ))}
        </ul>
      ) : (
        <p className="mb-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No categories yet. Add them here or sync to import the WordPress site&apos;s categories.
        </p>
      )}
      {isAdmin ? (
        <div className="space-y-5">
          <SyncCategoriesButton websiteId={websiteId} />
          <CategoryForm websiteId={websiteId} />
        </div>
      ) : null}
    </Card>
  );
}
