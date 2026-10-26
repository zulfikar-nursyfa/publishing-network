// Bootstraps the first (super) administrator for a Supabase project (staging or production).
//
//   node --env-file=.env.local scripts/create-admin.mjs someone@example.com "Full Name"
//
// Sends a Supabase invitation if the user does not exist yet, then grants the superadmin role.
// Also promotes an existing user to superadmin.
// After this, further users are invited from the dashboard's Users page.

import { createClient } from "@supabase/supabase-js";

const [email, fullName] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <email> ["Full Name"]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (use --env-file).");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let { data: profile } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();

if (!profile) {
  const { data, error } = await db.auth.admin.inviteUserByEmail(email.toLowerCase(), {
    data: { full_name: fullName ?? null },
    redirectTo: `${appUrl}/account/password`,
  });
  if (error) {
    console.error(`Invitation failed: ${error.message}`);
    process.exit(1);
  }
  profile = { id: data.user.id };
  console.log(`Invitation email sent to ${email}.`);
}

const { error } = await db.from("profiles").upsert({
  id: profile.id,
  email: email.toLowerCase(),
  role: "superadmin",
  ...(fullName ? { full_name: fullName } : {}),
});
if (error) {
  console.error(`Could not grant superadmin role: ${error.message}`);
  process.exit(1);
}

await db.from("audit_log").insert({
  action: "user.admin_bootstrapped",
  entity_type: "user",
  entity_id: profile.id,
  details: { email: email.toLowerCase(), via: "scripts/create-admin.mjs" },
});

console.log(`${email} is now a super administrator.`);
