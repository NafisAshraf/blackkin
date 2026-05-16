/**
 * Detects whether a string looks like a phone number.
 * Strips whitespace, dashes, and parentheses before testing.
 */
export function isPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[\s\-()]/g, "");
  return /^\+?\d{10,15}$/.test(cleaned);
}

/**
 * Normalizes a phone number input to E.164 format.
 * If no country code prefix, assumes Bangladesh (+88).
 */
export function normalizePhone(value: string): string {
  const cleaned = value.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("88")) return `+${cleaned}`;
  return `+88${cleaned}`;
}
