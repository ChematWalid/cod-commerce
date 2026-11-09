/**
 * The limiter key of one account on one address (D29). The address comes last and holds no `|`, so two
 * different pairs cannot produce the same key.
 */
export function loginPairKey(normalizedEmail: string, clientIp: string): string {
  return `${normalizedEmail}|${clientIp}`;
}
