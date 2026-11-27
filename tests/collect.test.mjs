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

const page = (url, published_at) => ({ url, published_at, primary: false, text: "Readable text." });
const reader = (dates) => async (url) => page(url, dates[url]);
const story = { url: "https://site.example/story", source_published_at: "2026-11-23T13:30:00Z" };
const job = { state: { searched: true, candidate_urls: [story.url, "https://other.example/a"] } };

test("an old story page stops the job at once, without another search", async () => {
  const read = reader({ [story.url]: "2025-09-10T00:00:00Z", "https://other.example/a": "2026-11-23T00:00:00Z" });
  await assert.rejects(collectStep(job, { sources: [], story }, { read }), (error) => {
    assert.ok(error instanceof PermanentJob);
    assert.match(
      error.message,
      /first published on 2025-09-10, more than 3 days before the feed listed it on 2026-11-23/,
    );
    return true;
  });
});

test("the niche's coverage window decides how old a supporting page may be", async () => {
  const read = reader({ [story.url]: "2026-11-23T10:00:00Z", "https://other.example/a": "2026-11-17T00:00:00Z" });
  const narrow = await collectStep(job, { sources: [], story }, { read });
  assert.deepEqual(
    narrow.evidence.map((p) => p.url),
    [story.url],
  );
  assert.match(narrow.skipped_pages[0].reason, /Published 2026-11-17, before this story/);

  const website = { niche: { coverage_window_days: 7 } };
  const wide = await collectStep(job, { sources: [], story, website }, { read });
  assert.deepEqual(
    wide.evidence.map((p) => p.url),
    [story.url, "https://other.example/a"],
  );
});
