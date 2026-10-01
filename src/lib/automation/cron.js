import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Without a secret, nothing is allowed. */
export function isCronRequest(request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
