import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  // 32 random bytes, base64 encoded. Generate with: npm run gen:key
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, {
      message: "must be 32 bytes encoded as base64 (run `npm run gen:key`)",
    }),
  // Allows http:// WordPress URLs. Only for the local Docker WordPress; never in staging/production.
  ALLOW_INSECURE_WORDPRESS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

let cached;

export function serverEnv() {
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(`Invalid server environment configuration:\n${problems}`);
    }
    if (parsed.data.ALLOW_INSECURE_WORDPRESS && parsed.data.APP_ENV !== "local") {
      throw new Error("ALLOW_INSECURE_WORDPRESS may only be enabled when APP_ENV=local");
    }
    cached = parsed.data;
  }
  return cached;
}
