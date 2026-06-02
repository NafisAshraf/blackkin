/**
 * Turnstile verification cookie helpers.
 * Uses the Web Crypto API — compatible with Cloudflare Workers (edge) and Node 18+.
 *
 * Cookie format:  <expires_ms>.<base64_hmac>
 * HMAC covers only the expiry timestamp, signed with TURNSTILE_COOKIE_SECRET.
 */

export const TURNSTILE_COOKIE = "_tsv";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function hmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  // base64 — base64 chars never contain "." so it's safe as the second segment
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createVerificationCookie(
  secret: string,
): Promise<string> {
  const expires = (Date.now() + TTL_MS).toString();
  const sig = await hmacSha256(secret, expires);
  return `${expires}.${sig}`;
}

export async function verifyVerificationCookie(
  value: string,
  secret: string,
): Promise<boolean> {
  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return false;

  const expires = value.slice(0, dotIdx);
  const sig = value.slice(dotIdx + 1);

  if (parseInt(expires, 10) < Date.now()) return false;

  const expected = await hmacSha256(secret, expires);
  // Constant-time string comparison to prevent timing attacks
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
