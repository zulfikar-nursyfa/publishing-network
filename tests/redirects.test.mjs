import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "@/lib/redirects";

test("safeNext keeps same-site paths", () => {
  assert.equal(safeNext("/review?status=approved#top"), "/review?status=approved#top");
  assert.equal(safeNext("/account/password"), "/account/password");
});

test("safeNext rejects anything that leaves the site", () => {
  for (const value of [
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    "evil.com",
    "",
    null,
  ]) {
    assert.equal(safeNext(value), "/", JSON.stringify(value));
  }
});
