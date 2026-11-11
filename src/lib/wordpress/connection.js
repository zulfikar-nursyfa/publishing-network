import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

import { REQUIRED_PLUGIN_VERSION, WordPressError, createWordPressClient } from "@/lib/wordpress/client";

/** Decrypts a website's WordPress credentials. Server-only; the password never reaches the browser. */
export async function loadConnection(website) {
  const { data } = await createAdminClient()
    .from("website_credentials")
    .select("wp_app_password_encrypted")
    .eq("website_id", website.id)
    .maybeSingle();
  if (!data) return null;
  return {
    baseUrl: website.wp_base_url,
    username: website.wp_username,
    appPassword: decryptSecret(data.wp_app_password_encrypted),
  };
}

export function assertAllowedWordPressUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "Enter a full URL, for example https://example.com";
  }
  if (parsed.protocol === "https:") return null;
  if (parsed.protocol === "http:" && serverEnv().ALLOW_INSECURE_WORDPRESS) return null;
  return "WordPress must be served over HTTPS (application passwords do not work over plain HTTP)";
}

/**
 * Checks that the dashboard can authenticate, that the connector plugin is installed and that
 * the WordPress user may publish. Records the outcome on the website row.
 */
export async function testConnection(website) {
  // Not connected yet is not a failure; leave the status untouched.
  if (!website.wp_base_url) return { ok: false, error: "Add the WordPress details in the website settings first." };
  const admin = createAdminClient();
  let result;

  const connection = await loadConnection(website);
  if (!connection) {
    result = { ok: false, error: "No application password saved for this website" };
  } else {
    try {
      const status = await createWordPressClient(connection, { timeoutMs: 15_000 }).getStatus();
      const warnings = [];
      if (!status.user.can_publish) {
        result = {
          ok: false,
          error: `WordPress user "${status.user.login}" cannot publish posts. Give it the Editor role.`,
        };
      } else {
        if (compareVersions(status.plugin_version, REQUIRED_PLUGIN_VERSION) < 0) {
          warnings.push(
            `Connector plugin ${status.plugin_version} is older than ${REQUIRED_PLUGIN_VERSION}; update it.`,
          );
        }
        const wpLanguage = status.language.toLowerCase().slice(0, 2);
        if (wpLanguage !== website.language) {
          warnings.push(
            `WordPress site language is ${status.language} but this website is set to ${website.language}.`,
          );
        }
        if (website.language === "ar" && !status.is_rtl) {
          warnings.push(
            "WordPress is not rendering right-to-left. Set the site language to Arabic in Settings → General.",
          );
        }
        if (!status.user.can_upload) warnings.push("WordPress user cannot upload media; illustrations will fail.");
        result = { ok: true, status, warnings };
      }
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof WordPressError || error instanceof Error ? error.message : String(error),
      };
    }
  }

  await admin
    .from("websites")
    .update({
      wp_connection_status: result.ok ? "ok" : "failed",
      wp_connection_checked_at: new Date().toISOString(),
      wp_connection_error: result.ok ? result.warnings.join(" ") || null : result.error,
      wp_plugin_version: result.ok ? result.status.plugin_version : website.wp_plugin_version,
    })
    .eq("id", website.id);

  return result;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
