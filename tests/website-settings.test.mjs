import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteSettingsSchema } from "@/lib/validation";

const base = {
  name: "Test site",
  domain: "example.com",
  language: "en",
  timezone: "UTC",
  automation_mode: "review",
  monthly_ai_budget_usd: "10",
};
const parse = (wordpress) => websiteSettingsSchema.safeParse({ ...base, ...wordpress });
const errorPaths = (result) => result.error.issues.map((issue) => issue.path.join("."));

test("WordPress details are optional", () => {
  const result = parse({ wp_base_url: "", wp_username: "", wp_app_password: "" });
  assert.equal(result.success, true);
  assert.equal(result.data.wp_base_url, null);
  assert.equal(result.data.wp_username, null);
});

test("a WordPress URL needs a username", () => {
  assert.deepEqual(errorPaths(parse({ wp_base_url: "https://example.com", wp_username: "" })), ["wp_username"]);
});

test("a username or password needs a WordPress URL", () => {
  assert.deepEqual(errorPaths(parse({ wp_username: "publisher" })), ["wp_base_url"]);
  assert.deepEqual(errorPaths(parse({ wp_app_password: "abcd efgh" })), ["wp_base_url"]);
});

test("complete WordPress details pass, invalid URLs do not", () => {
  const ok = parse({ wp_base_url: "https://example.com", wp_username: "publisher", wp_app_password: "abcd" });
  assert.equal(ok.success, true);
  assert.equal(ok.data.wp_base_url, "https://example.com");
  assert.deepEqual(errorPaths(parse({ wp_base_url: "not a url", wp_username: "publisher" })), ["wp_base_url"]);
});
