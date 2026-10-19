import "server-only";
import { cache } from "react";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user and profile, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) redirect("/login?error=no-profile");

  return {
    id: userId,
    email: profile.email,
    profile,
    isAdmin: profile.role === "admin",
  };
});

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}

/**
 * Loads a website the current user may access. Access is decided by row level security, so a
 * website the user is not assigned to is indistinguishable from one that does not exist.
 */
export async function requireWebsite(websiteId) {
  const user = await requireUser();
  if (!z.uuid().safeParse(websiteId).success) notFound();
  const supabase = await createClient();
  const { data: website } = await supabase.from("websites").select("*").eq("id", websiteId).maybeSingle();
  if (!website) notFound();
  return { user, website };
}
