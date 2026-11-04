import assert from "node:assert/strict";
import test from "node:test";
import { createWordPressClient } from "../src/lib/wordpress/client.js";

test("network errors include the underlying cause", async () => {
  const cause = Object.assign(new Error("getaddrinfo ENOTFOUND wp.example"), { code: "ENOTFOUND" });
  const client = createWordPressClient(
    { baseUrl: "https://wp.example", username: "u", appPassword: "p" },
    { fetch: async () => Promise.reject(new TypeError("fetch failed", { cause })) },
  );
  await assert.rejects(client.getStatus(), {
    message: "Could not reach WordPress: fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND wp.example)",
  });
});
