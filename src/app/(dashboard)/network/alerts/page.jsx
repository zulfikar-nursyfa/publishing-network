import Link from "next/link";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listContext, readList } from "@/lib/lists";
import { alertList } from "@/lib/list-configs";

export const metadata = { title: "Alert history" };
export default async function AlertsPage({ searchParams }) {
  await requireAdmin();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, alertList);
  const result = await readList(() => db.from("alerts").select("*", { count: "exact" }), state, timezone);
  const names = new Map(websites.map((site) => [site.id, site.name]));
  return (
    <>
      <PageHeader
        title="Alert history"
        back={{ href: "/network", label: "Network settings" }}
        description={`Recorded alert emails. Dates use ${timezone}.`}
      />
      <ListToolbar path="/network/alerts" state={state} websites={websites} searchLabel="Search alert messages" />
      <ListResults
        result={result}
        path="/network/alerts"
        state={state}
        title="No alerts yet"
        empty="Set recipients in Network settings to receive alerts."
      >
        <Table>
          <thead>
            <tr>
              <SortTh path="/network/alerts" state={state} column="kind">
                Kind
              </SortTh>
              <Th>Website</Th>
              <Th>Message</Th>
              <SortTh path="/network/alerts" state={state} column="created">
                Sent
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {result.data.map((alert) => (
              <tr key={alert.id}>
                <Td>
                  <Badge>{alert.kind}</Badge>
                </Td>
                <Td>
                  {alert.website_id ? (
                    <Link href={`/websites/${alert.website_id}`} className="hover:underline">
                      {names.get(alert.website_id) ?? "Website"}
                    </Link>
                  ) : (
                    "Network"
                  )}
                </Td>
                <Td className="min-w-56 max-w-xl">{alert.message}</Td>
                <Td>
                  <RelativeTime value={alert.created_at} timezone={timezone} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
