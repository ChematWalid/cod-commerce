import type { OAuthIdentity } from '../oauth';

/** One identity provider's redirect code flow with PKCE (D36). */
export interface OAuthProviderPort {
  /** The provider page the browser is sent to. */
  authorizeUrl(state: string, codeChallenge: string, redirectUri: string): string;
  /**
   * Trades the callback's code for who signed in.
   *
   * @throws OAuthFailedError when the provider refuses or cannot be reached.
   */
  exchange(code: string, codeVerifier: string, redirectUri: string): Promise<OAuthIdentity>;
}
