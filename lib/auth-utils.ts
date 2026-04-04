/**
 * Detects whether a string looks like a phone number vs. an email address.
 * Strips whitespace, dashes, and parentheses before testing.
 */
export function isPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[\s\-()]/g, "");
  return /^\+?\d{10,15}$/.test(cleaned);
}

/**
 * Normalizes a phone number input to a standard format.
 * If no country code prefix, assumes Bangladesh (+88).
 */
export function normalizePhone(value: string): string {
  const cleaned = value.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("88")) return `+${cleaned}`;
  return `+88${cleaned}`;
}

/**
 * Converts a phone number to a synthetic email used internally for auth.
 * The synthetic email is deterministic so sign-in always resolves the same user.
 */
export function phoneToSyntheticEmail(phone: string): string {
  return `${normalizePhone(phone).replace("+", "")}@phone.blackkin.local`;
}

/**
 * Returns true if an email is a synthetic phone-based placeholder.
 */
export function isSyntheticPhoneEmail(email: string | undefined | null): boolean {
  return !!email?.endsWith("@phone.blackkin.local");
}

/**
 * Extracts the phone number from a synthetic email.
 * e.g. "8801712345678@phone.blackkin.local" → "+8801712345678"
 */
export function syntheticEmailToPhone(email: string): string {
  return `+${email.replace("@phone.blackkin.local", "")}`;
}
