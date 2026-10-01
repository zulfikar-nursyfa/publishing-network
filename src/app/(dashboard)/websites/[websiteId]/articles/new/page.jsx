import { notFound } from "next/navigation";
import { createArticle } from "@/app/actions/articles";
import { PageHeader } from "@/components/ui";
import { requireWebsite } from "@/lib/auth";
import { ArticleForm } from "../../../../articles/article-form";

export const metadata = { title: "New article" };

export default async function NewArticlePage({ params }) {
  const { websiteId } = await params;
  const { website } = await requireWebsite(websiteId);
  if (website.archived_at) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: `/websites/${websiteId}`, label: website.name }}
        title="New article"
        description="Manual articles do not count against the automated daily quota."
      />
      <ArticleForm action={createArticle.bind(null, websiteId)} rtl={website.text_direction === "rtl"} submitLabel="Create draft" />
    </div>
  );
}
