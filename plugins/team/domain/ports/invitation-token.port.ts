/** Makes invitation tokens and the one-way form they are stored in (D205). */
export interface InvitationTokenPort {
  /** A new, unguessable token for one invitation link. */
  newToken(): string;
  /** The stored form of `token`; the same token always gives the same hash. */
  hash(token: string): string;
}
