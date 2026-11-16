import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/auth/forgot-password"];

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out visitors to the
 * login page. This is only an optimistic check; pages and actions verify access again.
 */
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not add code between client creation and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Cron endpoints authenticate with their own secret; WordPress sites fetch connector updates without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/connector|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
