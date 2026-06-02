import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TURNSTILE_COOKIE, createVerificationCookie } from "@/lib/turnstile";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function POST(request: NextRequest) {
  const body = await request.formData();
  const token = body.get("cf-turnstile-response");
  const rawNext = body.get("next");

  // Sanitise the redirect target — must be a relative path, no open-redirect
  const safeNext =
    typeof rawNext === "string" &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : "/";

  // Build the error redirect URL (back to challenge with ?error=1)
  const errorUrl = new URL("/challenge", request.url);
  errorUrl.searchParams.set("next", safeNext);
  errorUrl.searchParams.set("error", "1");

  if (typeof token !== "string" || !token) {
    return NextResponse.redirect(errorUrl, 303);
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const cookieSecret = process.env.TURNSTILE_COOKIE_SECRET;

  if (!secretKey || !cookieSecret) {
    return NextResponse.redirect(errorUrl, 303);
  }

  // Verify token with Cloudflare
  const verifyRes = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  });

  const verifyData = (await verifyRes.json()) as {
    success: boolean;
    "error-codes"?: string[];
  };

  if (!verifyData.success) {
    return NextResponse.redirect(errorUrl, 303);
  }

  // Issue signed verification cookie and redirect to destination.
  // Using 303 (POST → GET) so the browser commits Set-Cookie before loading
  // the next page — avoids the iOS Chrome cookie race condition that occurs
  // when using fetch() + window.location.replace().
  const cookieValue = await createVerificationCookie(cookieSecret);
  const successUrl = new URL(safeNext, request.url);
  const response = NextResponse.redirect(successUrl, 303);
  response.cookies.set(TURNSTILE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: "/",
  });

  return response;
}
