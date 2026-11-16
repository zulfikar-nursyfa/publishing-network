import assert from "node:assert/strict";
import { test } from "node:test";
import { collectStep } from "@/lib/automation/drafting/collect";
import { PermanentJob } from "@/lib/automation/drafting/errors";

test("with nothing readable, collect searches once more away from those sites, then stops", async () => {
  // Plain http pages are refused before any request, so this runs offline.
  const context = { sources: [], story: { source_published_at: "2026-11-16T00:00:00Z" } };
  const retry = await collectStep({ state: { searched: true, candidate_urls: ["http://blocked.example/a"] } }, context);
  assert.equal(retry.searched, false);
  assert.equal(retry.coverage_retried, true);
  assert.deepEqual(retry.unreadable_hosts, ["blocked.example"]);
  await assert.rejects(collectStep({ state: { ...retry, searched: true } }, context), PermanentJob);
});
