import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TURNSTILE_COOKIE, verifyVerificationCookie } from "@/lib/turnstile";

/**
 * 1. Injects `x-pathname` header for server-side layout redirect helpers.
 * 2. Gates every page route behind a Cloudflare Turnstile verification cookie.
 *    Visitors without a valid cookie are redirected to /challenge.
 *    The /challenge page and /api/turnstile endpoint are always allowed through.
 *
 * Auth is still checked in the (protected) layout via isAuthenticated() from
 * @convex-dev/better-auth — this middleware only blocks bots at the edge.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always inject pathname header (used by server layouts)
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);

  // Let the challenge page and its API through unconditionally
  if (pathname === "/challenge" || pathname.startsWith("/api/turnstile")) {
    return NextResponse.next({ request: { headers } });
  }

  const cookieSecret = process.env.TURNSTILE_COOKIE_SECRET;

  // If the secret is not configured (local dev without secrets), pass through
  if (!cookieSecret) {
    return NextResponse.next({ request: { headers } });
  }

  // Check for a valid verification cookie
  const cookieValue = request.cookies.get(TURNSTILE_COOKIE)?.value;
  if (cookieValue) {
    const valid = await verifyVerificationCookie(cookieValue, cookieSecret);
    if (valid) {
      return NextResponse.next({ request: { headers } });
    }
  }

  // No valid cookie — send to the challenge page
  const challengeUrl = new URL("/challenge", request.url);
  challengeUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(challengeUrl);
}

export const config = {
  // Run on all page routes; skip static assets, image optimiser, and API.
  matcher: [
    "/((?!_next/static|_next/image|api/|assets/|favicon\\.ico|robots\\.txt|_headers).*)",
  ],
};
