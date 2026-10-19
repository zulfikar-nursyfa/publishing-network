import assert from "node:assert/strict";
import { test } from "node:test";
import { canRemoveDraft } from "@/lib/draft-job-policy";

test("removal controls disappear for skipped or used stories while cancelled selections can be cleaned up", () => {
  for (const status of ["queued", "running", "failed", "cancelled"]) {
    assert.equal(canRemoveDraft({ status }, "selected"), true);
    assert.equal(canRemoveDraft({ status }, "new"), true);
    for (const storyStatus of ["skipped", "used", undefined, null])
      assert.equal(canRemoveDraft({ status }, storyStatus), false);
  }
  assert.equal(canRemoveDraft({ status: "succeeded" }, "selected"), false);
  assert.equal(canRemoveDraft(null, "selected"), false);
});
