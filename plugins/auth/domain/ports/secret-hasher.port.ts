/** Makes the secrets mailed to a user and the hashes kept in their place (D25). */
export interface SecretHasherPort {
  /** A new unguessable link token. */
  newToken(): string;
  /** A new one-time code. */
  newOtp(): string;
  /** The value stored for `secret`; the same secret always gives the same hash, so it can be looked up. */
  hash(secret: string): string;
  /** Whether `secret` produced `expectedHash`, in constant time. */
  matches(secret: string, expectedHash: string): boolean;
}
