import { ListToolbar, Pagination, ListEmpty } from "@/components/list-controls";
import { allRows, readList } from "@/lib/lists";
import { parseListParams, enumFilter, searchOr, uuidFilter } from "@/lib/list-params";
import { nicheList } from "@/lib/list-configs";
import Link from "next/link";
import { ListLoading } from "@/components/list-loading";
import { ChevronDown, ChevronRight, ExternalLink, Layers, Network, Plus } from "lucide-react";
import { addNicheSource, removeNicheSource, updateNicheSource } from "@/app/actions/niches";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NETWORK_KINDS, SOURCE_KINDS } from "@/lib/validation";
import { SourceForm } from "../websites/[websiteId]/settings/settings-forms";
import { AddNicheForm } from "./add-niche-form";
import { NicheGuideForm } from "./niche-guide-form";
import { NicheCategories } from "./niche-categories";
import { NetworkForm } from "./network-form";
import { NicheNetworkForm } from "./niche-network-form";
import { SourceRow } from "./source-row";

export const metadata = { title: "Niches" };

/** A collapsible part of a niche, closed by default so a niche opens as a short overview. */
function Section({ title, count, hint, children }) {
  return (
    <details className="group/section">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-90"
        />
        <span className="text-sm font-semibold">{title}</span>
        {count == null ? null : <Badge>{count}</Badge>}
        {hint ? <span className="ms-auto truncate ps-3 text-xs text-muted-foreground">{hint}</span> : null}
      </summary>
      <div className="space-y-3 px-4 pb-4 sm:px-6">{children}</div>
    </details>
  );
}

const feedHint = (sources) => {
  const feeds = sources.filter((source) => source.feed_url).length;
  return `${feeds} with a feed · ${sources.length - feeds} research only`;
};

const textHint = (en, ar) =>
  [
    ["English", en],
    ["Arabic", ar],
  ]
    .map(([label, text]) => `${label} ${text ? "set" : "not set"}`)
    .join(" · ");
const guideHint = (niche) => textHint(niche.guide_en, niche.guide_ar);

function SourceDetails({ source }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 font-medium">
        {source.name}
        <Badge>{SOURCE_KINDS[source.kind] ?? source.kind}</Badge>
        {source.kind === "newsroom" || source.kind === "government" ? <Badge tone="blue">primary</Badge> : null}
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
        {source.feed_url ? `Feed: ${source.feed_url}` : "No feed: used for research, not story discovery"}
      </div>
      {source.attribution_note ? (
        <div className="mt-1 text-xs text-muted-foreground">{source.attribution_note}</div>
      ) : null}
    </>
  );
}

export default async function NichesPage({ searchParams }) {
  await requireAdmin();
  const supabase = await createClient();
  const state = parseListParams(await searchParams, {
    ...nicheList,
    filters: {
      network: uuidFilter("Network", "network_id"),
      source_q: { label: "Search sources", text: true, default: "" },
      category_q: { label: "Search categories", text: true, default: "" },
      source_kind: enumFilter("Source kind", ["all", "news", "newsroom", "government", "api"]),
      category_language: enumFilter("Category language", ["all", "en", "ar"]),
      archived: enumFilter("Categories archived", ["all", "yes", "no"]),
    },
  });
  const [networksResult, nicheNetworks] = await Promise.all([
    supabase.from("networks").select("*").order("sort_order").order("id"),
    allRows(() => supabase.from("niches").select("id, network_id").order("id")).catch(() => []),
  ]);
  const networks = networksResult.data ?? [];
  const networkName = new Map(networks.map((network) => [network.id, network.name]));
  const result = await readList(() => supabase.from("niches").select("*", { count: "exact" }), state);
  const { data: niches, error } = result;
  const ids = niches.map((niche) => niche.id);
  const [sources, websites, categories] = ids.length
    ? await Promise.all([
        allRows(() => {
          let query = supabase.from("niche_sources").select("*").in("niche_id", ids).order("id");
          if (state.source_kind !== "all") query = query.eq("kind", state.source_kind);
          if (state.source_q) query = query.or(searchOr(["name", "url"], state.source_q));
          return query;
        }),
        allRows(() => supabase.from("websites").select("id, name, language, niche_id").in("niche_id", ids).order("id")),
        allRows(() => {
          let query = supabase.from("niche_categories").select("*").in("niche_id", ids).order("sort_order").order("id");
          if (state.category_q) query = query.or(searchOr(["name", "slug"], state.category_q));
          if (state.category_language !== "all") query = query.eq("language", state.category_language);
          if (state.archived !== "all")
            query = state.archived === "yes" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
          return query;
        }),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Niches"
        description="Shared sources, writing guides and starting categories for English and Arabic websites."
      />
      {networksResult.error ? (
        <Alert tone="error">Networks are unavailable. Apply migration 67 before using this page.</Alert>
      ) : (
        <Card
          icon={Network}
          title="Networks"
          description="A network groups niches and holds rules shared by all their websites. The AI follows them above each niche's writing guide."
        >
          <div className="divide-y rounded-lg border">
            {networks.map((network) => {
              const count = nicheNetworks.filter((niche) => niche.network_id === network.id).length;
              return (
                <details key={network.id} className="group/network">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open/network:rotate-90"
                    />
                    <span className="text-sm font-semibold">{network.name}</span>
                    <Badge>{NETWORK_KINDS[network.kind] ?? network.kind}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {count} niche{count === 1 ? "" : "s"}
                    </span>
                    <span className="ms-auto truncate text-xs text-muted-foreground">
                      Shared rules: {textHint(network.rules_en, network.rules_ar)}
                    </span>
                  </summary>
                  <div className="border-t p-4">
                    <NetworkForm network={network} />
                  </div>
                </details>
              );
            })}
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <Plus aria-hidden className="size-4" />
                Add a network
              </summary>
              <div className="border-t p-4">
                <NetworkForm />
              </div>
            </details>
          </div>
        </Card>
      )}
      <ListToolbar
        path="/niches"
        state={state}
        searchLabel="Search niche names"
        choices={{
          network: [
            { value: "all", label: "All networks" },
            ...networks.map((network) => ({ value: network.id, label: network.name })),
          ],
        }}
      />
      {!niches.length && !error ? (
        <ListEmpty path="/niches" state={state} title="No niches yet">
          Add a niche using the form below.
        </ListEmpty>
      ) : null}
      {error ? (
        <Alert tone="error">Niches are unavailable. Apply migrations 29 and 52 before using this page.</Alert>
      ) : (
        <>
          <ListLoading>
            <div className="space-y-3">
              {niches.map((niche) => {
                const group = (sources ?? []).filter((source) => source.niche_id === niche.id);
                const sites = (websites ?? []).filter((website) => website.niche_id === niche.id);
                const nicheCategories = categories.filter((category) => category.niche_id === niche.id);
                return (
                  <details key={niche.id} className="group rounded-lg bg-card">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg p-4 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Layers aria-hidden className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{niche.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {networkName.get(niche.network_id) ? `${networkName.get(niche.network_id)} network · ` : ""}
                          {group.length} source{group.length === 1 ? "" : "s"} ·{" "}
                          {sites.length
                            ? sites.map((site) => `${site.name} (${site.language.toUpperCase()})`).join(", ")
                            : "no websites yet"}
                        </div>
                      </div>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="divide-y border-t">
                      {sites.length ? (
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm sm:px-6">
                          <span className="me-1 font-semibold">Websites</span>
                          {sites.map((site) => (
                            <Link
                              key={site.id}
                              href={`/websites/${site.id}/settings`}
                              className="rounded-full border px-3 py-1 hover:bg-muted"
                            >
                              {site.name}
                              <span className="ms-1.5 text-xs text-muted-foreground uppercase">{site.language}</span>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                      <Section title="Shared sources" count={group.length} hint={feedHint(group)}>
                        {group.length ? (
                          <ul className="divide-y rounded-lg border">
                            {group.map((source) => (
                              <SourceRow
                                key={source.id}
                                details={<SourceDetails source={source} />}
                                actions={
                                  <ActionForm action={removeNicheSource.bind(null, niche.id, source.id)}>
                                    <SubmitButton
                                      variant="danger-outline"
                                      size="sm"
                                      confirmLabel="Remove"
                                      confirm={`Remove ${source.name} from ${niche.name}? It is also removed from every website in this niche.`}
                                    >
                                      Remove
                                    </SubmitButton>
                                  </ActionForm>
                                }
                              >
                                <SourceForm
                                  saveSource={updateNicheSource.bind(null, niche.id, source.id)}
                                  source={source}
                                />
                              </SourceRow>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                            No sources yet.
                          </p>
                        )}
                        <details className="rounded-lg border">
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                            <Plus aria-hidden className="size-4" />
                            Add a source
                          </summary>
                          <div className="border-t p-4">
                            <SourceForm saveSource={addNicheSource.bind(null, niche.id)} />
                          </div>
                        </details>
                      </Section>
                      <Section
                        title="Starting categories"
                        count={nicheCategories.length}
                        hint="Copied to new websites in this niche"
                      >
                        <NicheCategories nicheId={niche.id} categories={nicheCategories} />
                      </Section>
                      {networks.length ? (
                        <Section title="Network" hint={networkName.get(niche.network_id)}>
                          <NicheNetworkForm niche={niche} networks={networks} />
                        </Section>
                      ) : null}
                      <Section title="Writing guides" hint={guideHint(niche)}>
                        {"guide_en" in niche ? (
                          <NicheGuideForm niche={niche} />
                        ) : (
                          <Alert tone="error">Apply migration 34 to edit writing guides.</Alert>
                        )}
                      </Section>
                    </div>
                  </details>
                );
              })}
            </div>
            <Pagination path="/niches" state={state} count={result.count ?? 0} />
          </ListLoading>
          <Card
            icon={Plus}
            title="Add a niche"
            description="A niche shares sources, categories and writing guides between websites."
          >
            <AddNicheForm networks={networks} />
          </Card>
        </>
      )}
    </div>
  );
}
