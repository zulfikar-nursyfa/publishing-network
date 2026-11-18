import assert from "node:assert/strict";
import test from "node:test";
import { staleTermNames } from "../src/lib/wordpress/categories.js";

test("linked WordPress terms with an old name are renamed to the dashboard's", () => {
  const remote = [
    { id: 8, name: "Investment", slug: "investment", description: "" },
    { id: 2, name: "Tech &amp; AI Business", slug: "tech-ai-business", description: "AI" },
    { id: 5, name: "أخبار", slug: "news", description: "" },
    { id: 9, name: "Unlinked", slug: "unlinked", description: "" },
  ];
  const local = [
    { wp_term_id: 8, name: "استثمار" },
    // WordPress escapes "&", so the same name must not count as a change.
    { wp_term_id: 2, name: "Tech & AI Business" },
    { wp_term_id: 5, name: "أخبار" },
    // Not linked yet, or linked to a term WordPress no longer lists: nothing to rename.
    { wp_term_id: null, name: "جديد" },
    { wp_term_id: 77, name: "محذوف" },
  ];
  assert.deepEqual(staleTermNames(local, remote), [{ term: remote[0], name: "استثمار" }]);
});
