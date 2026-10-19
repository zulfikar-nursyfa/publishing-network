import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { addNicheSource, removeNicheSource, updateNicheSource } from "@/app/actions/niches";
import { SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SOURCE_KINDS } from "@/lib/validation";
import { SourceForm } from "../websites/[websiteId]/settings/settings-forms";
import { AddNicheForm } from "./add-niche-form";
import { NicheGuideForm } from "./niche-guide-form";
import { NicheCategories } from "./niche-categories";

export const metadata = { title: "Niches" };

export default async function NichesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: niches, error }, { data: sources }, { data: websites }, { data: categories, error: categoryError }] =
    await Promise.all([
      supabase.from("niches").select("*").order("sort_order"),
      supabase.from("niche_sources").select("*").order("name"),
      supabase.from("websites").select("id, name, language, niche_id").not("niche_id", "is", null).order("name"),
      supabase.from("niche_categories").select("*").order("sort_order").order("name"),
    ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Niches"
        description="Shared sources, writing guides and starting categories for English and Arabic websites."
      />
      {error ? (
        <Alert tone="error">Niches are unavailable. Apply migration 29 before using this page.</Alert>
      ) : (
        <>
          <div className="space-y-3">
            {niches.map((niche) => {
              const group = (sources ?? []).filter((source) => source.niche_id === niche.id);
              const sites = (websites ?? []).filter((website) => website.niche_id === niche.id);
              return (
                <details key={niche.id} className="group rounded-xl border bg-card shadow-xs">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:px-6">
                    <div className="min-w-0">
                      <div className="font-semibold">{niche.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {group.length} source{group.length === 1 ? "" : "s"} ·{" "}
                        {sites.length
                          ? sites.map((site) => `${site.name} (${site.language.toUpperCase()})`).join(", ")
                          : "no websites yet"}
                      </div>
                    </div>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-5 border-t p-4 sm:px-6">
                    {sites.length ? (
                      <div className="flex flex-wrap gap-2 text-sm">
                        {sites.map((site) => (
                          <Link
                            key={site.id}
                            href={`/websites/${site.id}/settings`}
                            className="text-primary hover:underline"
                          >
                            {site.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {group.length ? (
                      <ul className="divide-y rounded-lg border">
                        {group.map((source) => (
                          <li
                            key={source.id}
                            className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 font-medium">
                                {source.name}
                                <Badge>{SOURCE_KINDS[source.kind] ?? source.kind}</Badge>
                                {source.kind === "newsroom" || source.kind === "government" ? (
                                  <Badge tone="blue">primary</Badge>
                                ) : null}
                                {source.images_reusable ? <Badge tone="green">images reusable</Badge> : null}
                              </div>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              >
                                <span className="truncate">{source.url}</span>
                                <ExternalLink className="size-3 shrink-0" />
                              </a>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {source.feed_url ? `Feed: ${source.feed_url}` : "No feed: not used for story discovery"}
                              </div>
                              {source.attribution_note ? (
                                <div className="mt-1 text-xs text-muted-foreground">{source.attribution_note}</div>
                              ) : null}
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-medium text-primary">Edit</summary>
                                <div className="mt-2">
                                  <SourceForm
                                    saveSource={updateNicheSource.bind(null, niche.id, source.id)}
                                    source={source}
                                  />
                                </div>
                              </details>
                            </div>
                            <form action={removeNicheSource.bind(null, niche.id, source.id)} className="shrink-0">
                              <SubmitButton
                                variant="danger-outline"
                                size="sm"
                                confirmLabel="Remove"
                                confirm={`Remove ${source.name} from ${niche.name}? It is also removed from every website in this niche.`}
                              >
                                Remove
                              </SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        No sources yet.
                      </p>
                    )}
                    <SourceForm saveSource={addNicheSource.bind(null, niche.id)} />
                    {categoryError ? (
                      <Alert tone="error">Categories are unavailable. Apply migration 38_niche_categories.sql.</Alert>
                    ) : (
                      <NicheCategories
                        nicheId={niche.id}
                        categories={(categories ?? []).filter((category) => category.niche_id === niche.id)}
                      />
                    )}
                    {"guide_en" in niche ? (
                      <NicheGuideForm niche={niche} />
                    ) : (
                      <Alert tone="error">Apply migration 34 to edit writing guides.</Alert>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
          <Card title="Add a niche">
            <AddNicheForm />
          </Card>
        </>
      )}
    </div>
  );
}
