/** The sign-in providers behind `AUTH_OAUTH_ENABLED`. The name is also the stored `ExternalAuthenticationMethod.strategy`. */
export const OAUTH_PROVIDER_NAMES = ['google', 'facebook'] as const;

/** One of the {@link OAUTH_PROVIDER_NAMES}. */
export type OAuthProviderName = (typeof OAUTH_PROVIDER_NAMES)[number];

/** Who a provider says signed in. */
export interface OAuthIdentity {
  readonly provider: OAuthProviderName;
  /** The provider's stable id for the person; an email can change, this cannot. */
  readonly subject: string;
  /** Normalised; null when the provider has none to share. */
  readonly email: string | null;
  /** True only when the provider itself states that this person controls the address. */
  readonly emailVerified: boolean;
  readonly firstName: string;
  readonly lastName: string;
}

/** What survives the trip to the provider, inside `state`. */
export interface OAuthFlowState {
  readonly provider: OAuthProviderName;
  readonly codeVerifier: string;
  /** Hash of the value in the browser's binding cookie: the proof that this browser started the flow (login CSRF). */
  readonly bindingHash: string;
  readonly expiresAtMs: number;
}

/** What an `oauth-ticket` row carries. `identity` is set only while no account exists for the person. */
export interface OAuthTicketPayload {
  readonly bindingHash: string;
  readonly identity: OAuthIdentity | null;
}

/** What a browser may learn about its own new-identity ticket, to fill the sign-up form. */
export type OAuthTicketPreview = Pick<OAuthIdentity, 'provider' | 'email' | 'emailVerified' | 'firstName' | 'lastName'>;

/** Where a finished callback sends the browser: `register` for a new identity, `sign-in` for a known account. */
export interface OAuthCompletion {
  readonly destination: 'register' | 'sign-in';
  readonly ticket: string;
}
