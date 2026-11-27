import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { validationIssues } from "@/lib/automation/jobs";

test("a failed AI response keeps which fields were wrong", () => {
  const result = z.object({ claims: z.array(z.string()).min(3) }).safeParse({ claims: ["a", 1] });
  assert.equal(
    validationIssues(result.error),
    "claims.1: Invalid input: expected string, received number; claims: Too small: expected array to have >=3 items",
  );
});
