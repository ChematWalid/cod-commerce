/** The one form of an email address used for lookups, uniqueness and throttle keys. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
