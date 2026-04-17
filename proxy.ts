import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Header name our layouts read to reconstruct the inbound path. Next doesn't
 * surface request.nextUrl.pathname to Server Components directly, so we
 * forward it as a request header the app-layer `requireAuth` can read.
 */
export const PATHNAME_HEADER = "x-cs-pathname";

/**
 * Refreshes the Supabase auth token cookie if it's about to expire and
 * stamps the inbound pathname as a header. Runs on every matched request.
 * Noop when Supabase env is missing (local dev).
 *
 * Next 16 renamed this file convention from `middleware.ts` to `proxy.ts`
 * and the export from `middleware` to `proxy`.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname + request.nextUrl.search;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, path);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser forces the middleware-side session refresh if needed.
  // Do not read its return value here — route-level helpers call getUser
  // again to enforce auth.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon, common image extensions
     * - the Sentry monitoring tunnel route
     */
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
