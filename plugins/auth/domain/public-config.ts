/** What a client needs to know before showing the sign-up and login pages. */
export interface AuthPublicConfig {
  readonly oauthEnabled: boolean;
  readonly oauthProviders: readonly string[];
  /** The page of the challenge widget; null while the challenge is off (D35). */
  readonly challengeUrl: string | null;
  /** The validated `PLATFORM_DOMAIN`: a store's address is `<subdomain>.<platformDomain>`. */
  readonly platformDomain: string;
}
