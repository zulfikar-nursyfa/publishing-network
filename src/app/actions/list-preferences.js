"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser, requireWebsite } from "@/lib/auth";
import { WEBSITE_COOKIE } from "@/lib/lists";

export async function rememberWebsite(value) {
  await requireUser();
  const parsed = z.union([z.uuid(), z.literal("all")]).safeParse(value);
  if (!parsed.success) return;
  if (value !== "all") await requireWebsite(value);
  (await cookies()).set(WEBSITE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}
