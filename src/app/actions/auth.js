"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function safeNext(value) {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site relative paths to avoid open redirects.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_prev, formData) {
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string().min(1) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password" };

  await recordAudit({ action: "auth.sign_in", entityType: "user", entityId: data.user.id, actorId: data.user.id });
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev, formData) {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address" };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${serverEnv().NEXT_PUBLIC_APP_URL}/account/password`,
  });
  // Same response whether or not the account exists.
  return { ok: true, message: "If that address has an account, a reset link is on its way." };
}

export async function setPassword(_prev, formData) {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters" };
  if (password !== confirm) return { error: "The passwords do not match" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await recordAudit({ action: "auth.password_changed", entityType: "user", entityId: user.id, actorId: user.id });
  return { ok: true, message: "Password saved." };
}
