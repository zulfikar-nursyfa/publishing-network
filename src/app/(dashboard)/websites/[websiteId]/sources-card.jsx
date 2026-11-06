import Link from "next/link";
import { MousePointerClick } from "lucide-react";
import { Card, Table, Td, Th, linkClass } from "@/components/ui";

const number = (value) => new Intl.NumberFormat("en-GB").format(value);
const CHANNELS = [
  ["phone", "Phone"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
];

/** Where visits came from and contact-link clicks per page, last 28 days (GA4 only). */
export async function SourcesCard({ supabase, website }) {
  if (!website.ga4_property_id) return null;
  const [{ data: sources }, { data: contacts }] = await Promise.all([
    supabase
      .from("website_traffic_sources")
      .select("channel, source, sessions, users")
      .eq("website_id", website.id)
      .order("sessions", { ascending: false })
      .limit(10),
    supabase
      .from("website_contact_clicks")
      .select("path, channel, clicks, article:articles(id, title)")
      .eq("website_id", website.id),
  ]);
  const byChannel = Object.fromEntries(CHANNELS.map(([key]) => [key, 0]));
  const byPage = new Map();
  for (const row of contacts ?? []) {
    byChannel[row.channel] += row.clicks;
    const page = byPage.get(row.path) ?? { path: row.path, article: row.article, clicks: 0 };
    page.clicks += row.clicks;
    byPage.set(row.path, page);
  }
  const topPages = [...byPage.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  const total = Object.values(byChannel).reduce((sum, value) => sum + value, 0);
  const rtl = website.text_direction === "rtl";

  return (
    <Card
      icon={MousePointerClick}
      title="Traffic sources and contact clicks, last 28 days"
      description="Sources come from Google Analytics. Contact clicks count taps on phone, email and WhatsApp links, sent by the connector plugin."
      className="mb-8"
    >
      <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["total", "Contact clicks"], ...CHANNELS].map(([key, label]) => (
          <div key={key}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{number(key === "total" ? total : byChannel[key])}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table>
          <thead>
            <tr>
              <Th>Channel</Th>
              <Th>Source</Th>
              <Th className="text-right">Sessions</Th>
              <Th className="text-right">Users</Th>
            </tr>
          </thead>
          <tbody>
            {sources?.length ? (
              sources.map((row) => (
                <tr key={`${row.channel}\n${row.source}`}>
                  <Td>{row.channel}</Td>
                  <Td>
                    <span className="block max-w-xs truncate">{row.source}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{number(row.sessions)}</Td>
                  <Td className="text-right tabular-nums">{number(row.users)}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td className="text-muted-foreground">No data yet.</Td>
              </tr>
            )}
          </tbody>
        </Table>
        <Table>
          <thead>
            <tr>
              <Th>Page</Th>
              <Th className="text-right">Contact clicks</Th>
            </tr>
          </thead>
          <tbody>
            {topPages.length ? (
              topPages.map((page) => (
                <tr key={page.path}>
                  <Td>
                    {page.article ? (
                      <Link
                        href={`/articles/${page.article.id}`}
                        dir={rtl ? "rtl" : undefined}
                        className={`${linkClass} block max-w-xs truncate`}
                      >
                        {page.article.title}
                      </Link>
                    ) : (
                      <span dir="auto" className="block max-w-xs truncate text-muted-foreground">
                        {page.path}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{number(page.clicks)}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td className="text-muted-foreground">No contact clicks yet.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
