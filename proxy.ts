import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TURNSTILE_COOKIE, verifyVerificationCookie } from "@/lib/turnstile";

// Turnstile is intentionally disabled for the ExonHost migration/test
// deployment. Keep the implementation in place so it can be re-enabled later
// by setting this flag to true and restoring the required Turnstile env vars.
const TURNSTILE_ENABLED = false;

/**
 * 1. Injects `x-pathname` for server-side layout redirect helpers.
 * 2. Keeps the old Cloudflare Turnstile gate dormant while
 *    TURNSTILE_ENABLED=false for the ExonHost migration/test deployment.
 *
 * Auth is still checked in the protected layout via @convex-dev/better-auth.
 * If Turnstile is re-enabled later, this proxy can redirect unverified
 * visitors to /challenge again.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always inject pathname header (used by server layouts).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);

  if (!TURNSTILE_ENABLED) {
    return NextResponse.next({ request: { headers } });
  }

  // Turnstile re-enable path: let the challenge page and its API through.
  if (pathname === "/challenge" || pathname.startsWith("/api/turnstile")) {
    return NextResponse.next({ request: { headers } });
  }

  const cookieSecret = process.env.TURNSTILE_COOKIE_SECRET;

  // If the secret is not configured (local dev without secrets), pass through.
  if (!cookieSecret) {
    return NextResponse.next({ request: { headers } });
  }

  const cookieValue = request.cookies.get(TURNSTILE_COOKIE)?.value;
  if (cookieValue) {
    const valid = await verifyVerificationCookie(cookieValue, cookieSecret);
    if (valid) {
      return NextResponse.next({ request: { headers } });
    }
  }

  // Turnstile re-enable path: no valid cookie, send to the challenge page.
  const challengeUrl = new URL("/challenge", request.url);
  challengeUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(challengeUrl);
}

export const config = {
  // Run on all page routes; skip static assets, image optimizer, and API.
  matcher: [
    "/((?!_next/static|_next/image|api/|assets/|favicon\\.ico|robots\\.txt|_headers).*)",
  ],
};
