import Link from "next/link";
import {
  CircleCheck,
  CircleDollarSign,
  CirclePause,
  ClipboardCheck,
  FileText,
  Globe,
  Plus,
  Send,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { setNetworkPaused } from "@/app/actions/network";
import { SubmitButton } from "@/components/form-controls";
import {
  Alert,
  ArticleStatusBadge,
  Badge,
  ButtonLink,
  ConnectionBadge,
  EmptyState,
  PageHeader,
  SectionHeading,
  Stat,
  Table,
  Td,
  Th,
  formatDateTime,
  linkClass,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: websites }, { data: stats }, { data: recent }, { data: failures }, { data: network }, { data: spend, error: spendError }] = await Promise.all([
    supabase.from("websites").select("id, name, domain, language, daily_quota, automation_paused, wp_connection_status, archived_at").is("archived_at", null).order("name"),
    supabase.from("website_article_stats").select("*"),
    supabase
      .from("articles")
      .select("id, title, status, website_id, published_at, updated_at, wp_post_url")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("publications")
      .select("article_id, website_id, last_error, attempt_count, max_attempts, updated_at")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase.from("network_settings").select("automation_paused").maybeSingle(),
    supabase.from("website_ai_spend").select("*"),
  ]);

  const statsBySite = new Map((stats ?? []).map((row) => [row.website_id, row]));
  const siteName = new Map((websites ?? []).map((site) => [site.id, site.name]));
  const totals = (stats ?? []).reduce(
    (sum, row) => ({
      inReview: sum.inReview + Number(row.in_review),
      approved: sum.approved + Number(row.approved),
      today: sum.today + Number(row.published_today),
      week: sum.week + Number(row.published_7d),
      failed: sum.failed + Number(row.failed_publications),
    }),
    { inReview: 0, approved: 0, today: 0, week: 0, failed: 0 },
  );
  const firstName = (user.profile.full_name || "").split(" ")[0];
  const estimatedSpend = (spend ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  const reservedSpend = (spend ?? []).reduce((sum, row) => sum + Number(row.reserved_cost_usd), 0);

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Overview"}
        description={user.isAdmin ? "Here is what is happening across the network." : "Here is what is happening on your websites."}
        actions={
          user.isAdmin ? (
            <>
              {!network?.automation_paused ? (
                <form action={setNetworkPaused.bind(null, true)}>
                  <SubmitButton
                    variant="secondary"
                    confirm="Pause automation on every website? Publishing slots stop until you resume. Manual and scheduled publishing continue."
                    confirmLabel="Pause all automation"
                  >
                    <CirclePause />
                    Pause all automation
                  </SubmitButton>
                </form>
              ) : null}
              <ButtonLink href="/websites/new">
                <Plus />
                Add website
              </ButtonLink>
            </>
          ) : null
        }
      />

      {network?.automation_paused ? (
        <Alert tone="warning" title="Automation is paused across the network" className="mb-8">
          Publishing slots do not run on any website. Manual and scheduled publishing continue.
          {user.isAdmin ? (
            <form action={setNetworkPaused.bind(null, false)} className="mt-3">
              <SubmitButton size="sm" variant="secondary">Resume automation</SubmitButton>
            </form>
          ) : null}
        </Alert>
      ) : null}

      <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Pending review" value={totals.inReview} href="/review" icon={ClipboardCheck} tone="amber" />
        <Stat label="Ready to publish" value={totals.approved} icon={CircleCheck} tone="blue" />
        <Stat label="Published today" value={totals.today} hint="In each site's timezone" icon={Send} tone="green" />
        <Stat label="Published 7 days" value={totals.week} icon={TrendingUp} tone="purple" />
        <Stat label="Failed publishing" value={totals.failed} icon={TriangleAlert} tone="red" alert={totals.failed > 0} />
        <Stat label="AI spend (est.)" value={spendError ? "—" : `$${estimatedSpend.toFixed(2)}`} hint={spendError ? "Apply automation migrations" : `UTC month · $${reservedSpend.toFixed(2)} reserved`} href="/jobs" icon={CircleDollarSign} />
      </div>

      <section className="mb-10">
        <SectionHeading
          title="Websites"
          description={`${websites?.length ?? 0} active`}
          actions={websites && websites.length > 0 ? <Link href="/websites" className="text-sm font-medium text-primary underline-offset-4 hover:underline">View all</Link> : null}
        />
        {websites && websites.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Website</Th>
                <Th className="hidden md:table-cell">Connection</Th>
                <Th className="hidden md:table-cell">Automation</Th>
                <Th className="text-right">In review</Th>
                <Th className="hidden text-right sm:table-cell">Approved</Th>
                <Th className="hidden text-right sm:table-cell">Today</Th>
                <Th className="text-right">Failed</Th>
              </tr>
            </thead>
            <tbody>
              {websites.map((site) => {
                const row = statsBySite.get(site.id);
                return (
                  <tr key={site.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground sm:flex">
                          {site.language}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/websites/${site.id}`} className={linkClass}>{site.name}</Link>
                          <div className="truncate text-xs text-muted-foreground">{site.domain} · {site.language === "ar" ? "Arabic" : "English"}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1 md:hidden">
                            <ConnectionBadge status={site.wp_connection_status} />
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell"><ConnectionBadge status={site.wp_connection_status} /></Td>
                    <Td className="hidden md:table-cell">{site.automation_paused ? <Badge dot>paused</Badge> : <Badge tone="green" dot>{site.daily_quota}/day</Badge>}</Td>
                    <Td className="text-right tabular-nums">{row?.in_review ?? 0}</Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell">{row?.approved ?? 0}</Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell">{row?.published_today ?? 0}</Td>
                    <Td className="text-right tabular-nums">
                      {Number(row?.failed_publications ?? 0) > 0 ? <span className="font-semibold text-red-600 dark:text-red-400">{row?.failed_publications}</span> : <span className="text-muted-foreground">0</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={Globe}
            title="No websites yet"
            action={user.isAdmin ? <ButtonLink href="/websites/new"><Plus />Add the first website</ButtonLink> : null}
          >
            {user.isAdmin ? "Connect a WordPress site to start publishing." : "You are not assigned to any websites yet. Ask an administrator to add you."}
          </EmptyState>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionHeading title="Recent articles" />
          {recent && recent.length > 0 ? (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
              {recent.map((article) => (
                <li key={article.id}>
                  <Link href={`/articles/${article.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                    <span className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground sm:flex">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{article.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{siteName.get(article.website_id) ?? "Archived website"} · {formatDateTime(article.updated_at)}</div>
                    </div>
                    <ArticleStatusBadge status={article.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileText}>No articles yet.</EmptyState>
          )}
        </section>
        <section className="min-w-0">
          <SectionHeading title="Publishing failures" />
          {failures && failures.length > 0 ? (
            <ul className="divide-y overflow-hidden rounded-xl border border-red-500/20 bg-card shadow-xs">
              {failures.map((failure) => (
                <li key={failure.article_id}>
                  <Link href={`/articles/${failure.article_id}`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-red-500/5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                      <TriangleAlert className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {siteName.get(failure.website_id) ?? "Website"}
                        <span className="font-normal text-muted-foreground"> · attempt {failure.attempt_count} of {failure.max_attempts}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-red-700 dark:text-red-300">{failure.last_error}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CircleCheck}>No failed publishing attempts. All clear.</EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
