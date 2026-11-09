import { normalizeEmail, OAUTH_TICKET_TTL_MS } from '@cod/shared';
import type { AccountToken } from '../domain/account-token';
import { OAUTH_STATE_TTL_MS } from '../domain/constants';
import { InvalidTokenError, OAuthFailedError, OAuthLinkRequiresVerificationError } from '../domain/errors';
import type {
  OAuthCompletion,
  OAuthFlowState,
  OAuthIdentity,
  OAuthProviderName,
  OAuthTicketPayload,
  OAuthTicketPreview,
} from '../domain/oauth';
import type { AccountIdentityPort, AccountRecord, EmailClaimPort } from '../domain/ports/account-identity.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { ExternalIdentityPort } from '../domain/ports/external-identity.port';
import type { OAuthProviderPort } from '../domain/ports/oauth-provider.port';
import type { OAuthStateStorePort } from '../domain/ports/oauth-state-store.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';
import type { AccountTokenService } from './account-token.service';

/** The PKCE pair of one flow. */
export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
}

/** What {@link OAuthSignInService} works with. */
export interface OAuthSignInPorts {
  readonly providers: Partial<Readonly<Record<OAuthProviderName, OAuthProviderPort>>>;
  readonly state: OAuthStateStorePort;
  readonly identity: Pick<AccountIdentityPort, 'inTransaction' | 'findByEmail' | 'findByUserId' | 'markEmailVerified'>;
  readonly external: ExternalIdentityPort;
  readonly claims: EmailClaimPort;
  readonly tokens: Pick<AccountTokenService, 'issue' | 'consumeBound' | 'peekBound'>;
  readonly hasher: SecretHasherPort;
  readonly clock: ClockPort;
  readonly newPkce: () => PkcePair;
  /** The absolute address of the API; the provider sends the browser back under it. */
  readonly apiBaseUrl: string;
}

/** A flow just started: where to send the browser, and the value for its binding cookie. */
export interface OAuthStart {
  readonly authorizeUrl: string;
  readonly bindingValue: string;
}

/** What the provider sent to the callback. */
export interface OAuthCallbackParams {
  readonly state: string | undefined;
  readonly code: string | undefined;
}

/** A new identity's ticket, redeemed by the registration that is about to create its account. */
export interface RedeemedOAuthRegistration {
  readonly identity: OAuthIdentity;
  readonly bindingHash: string;
  readonly password: string;
}

/** The finished account a registration hands back. */
export interface OAuthRegistrationOutcome {
  readonly emailVerified: boolean;
  readonly signInTicket: string;
}

/** Google and Facebook sign-in: a redirect code flow ending in a single-use ticket bound to the browser (D36). */
export class OAuthSignInService {
  constructor(private readonly ports: OAuthSignInPorts) {}

  /** Whether `provider` is one this deployment offers. */
  offers(provider: string): provider is OAuthProviderName {
    return Object.hasOwn(this.ports.providers, provider);
  }

  /** Starts a flow for a provider {@link offers} accepted. The browser must keep `bindingValue` in its cookie. */
  begin(provider: OAuthProviderName): OAuthStart {
    const { hasher, state, newPkce, clock } = this.ports;
    const bindingValue = hasher.newToken();
    const { verifier, challenge } = newPkce();
    const sealed = state.write({
      provider,
      codeVerifier: verifier,
      bindingHash: hasher.hash(bindingValue),
      expiresAtMs: clock.now().getTime() + OAUTH_STATE_TTL_MS,
    });
    return {
      bindingValue,
      authorizeUrl: this.provider(provider).authorizeUrl(sealed, challenge, this.callback(provider)),
    };
  }

  /**
   * Checks the browser and `state` before spending the code, so a forged callback costs nothing and learns nothing.
   *
   * @throws OAuthFailedError for a forged or stale callback, or a provider refusal.
   * @throws OAuthLinkRequiresVerificationError when the email belongs to an account it may not be linked to.
   */
  async complete(
    ctx: OperationContext,
    provider: OAuthProviderName,
    params: OAuthCallbackParams,
    binding: string | undefined,
  ): Promise<OAuthCompletion> {
    const flow = this.verifiedFlow(provider, params.state, binding);
    if (params.code === undefined) {
      throw new OAuthFailedError();
    }
    const raw = await this.provider(provider).exchange(params.code, flow.codeVerifier, this.callback(provider));
    const identity = { ...raw, email: raw.email === null ? null : normalizeEmail(raw.email) };
    return this.ports.identity.inTransaction(ctx, (transactional) =>
      this.settle(transactional, identity, flow.bindingHash),
    );
  }

  /** What a new identity's ticket holds, for its own browser. Spends nothing. @throws InvalidTokenError otherwise. */
  async preview(ctx: OperationContext, ticket: string, binding: string | undefined): Promise<OAuthTicketPreview> {
    const row = await this.ports.tokens.peekBound(ctx, 'oauth-ticket', ticket, binding);
    const identity = this.identityOf(row);
    const { provider, email, emailVerified, firstName, lastName } = identity;
    return { provider, email, emailVerified, firstName, lastName };
  }

  /**
   * Spends a known account's ticket. A new identity's ticket is refused without being spent: only registration can
   * use it.
   *
   * @throws InvalidTokenError for anything but an open ticket of this browser with an account.
   */
  async signIn(ctx: OperationContext, ticket: string, binding: string | undefined): Promise<number> {
    const open = await this.ports.tokens.peekBound(ctx, 'oauth-ticket', ticket, binding);
    if (open.userId === null) {
      throw new InvalidTokenError();
    }
    const { userId } = await this.ports.tokens.consumeBound(ctx, 'oauth-ticket', ticket, binding);
    if (userId === null || (await this.ports.identity.findByUserId(ctx, userId)) === undefined) {
      throw new InvalidTokenError();
    }
    return userId;
  }

  /**
   * Spends a new identity's ticket inside the registration's transaction, so a registration that fails leaves it
   * usable. Provisioning needs a password, so the account gets one nobody knows; its owner can set a real one through
   * the emailed reset.
   *
   * @throws InvalidTokenError for anything but an open ticket of this browser with no account.
   */
  async redeemForRegistration(
    ctx: OperationContext,
    ticket: string,
    binding: string | undefined,
  ): Promise<RedeemedOAuthRegistration> {
    const row = await this.ports.tokens.consumeBound(ctx, 'oauth-ticket', ticket, binding);
    const identity = this.identityOf(row);
    return { identity, bindingHash: this.payloadOf(row).bindingHash, password: this.ports.hasher.newToken() };
  }

  /**
   * Refuses a subject that got an account since its ticket was issued. Call it holding the claims, so that two
   * tickets of one person cannot both pass.
   *
   * @throws InvalidTokenError when the subject is already linked.
   */
  async assertSubjectFree(ctx: OperationContext, identity: OAuthIdentity): Promise<void> {
    await this.ports.claims.claim(ctx, subjectClaim(identity));
    if ((await this.ports.external.findUserId(ctx, identity.provider, identity.subject)) !== undefined) {
      throw new InvalidTokenError();
    }
  }

  /** Links the new account and issues the ticket that signs it in; it has no password to log in with. */
  async finishRegistration(
    ctx: OperationContext,
    redeemed: RedeemedOAuthRegistration,
    account: { readonly userId: number; readonly administratorId: number },
  ): Promise<OAuthRegistrationOutcome> {
    const { external, identity, clock } = this.ports;
    const { provider, subject, emailVerified } = redeemed.identity;
    await external.link(ctx, account.userId, provider, subject);
    if (emailVerified) {
      await identity.markEmailVerified(ctx, account.administratorId, clock.now());
    }
    return { emailVerified, signInTicket: await this.issue(ctx, account.userId, redeemed.bindingHash) };
  }

  /** The address of the provider's return leg, under the API's public address. */
  private callback(provider: OAuthProviderName): string {
    return `${this.ports.apiBaseUrl.replace(/\/+$/, '')}/auth/oauth/${provider}/callback`;
  }

  private provider(name: OAuthProviderName): OAuthProviderPort {
    const provider = this.ports.providers[name];
    if (provider === undefined) {
      throw new OAuthFailedError();
    }
    return provider;
  }

  private verifiedFlow(
    provider: OAuthProviderName,
    state: string | undefined,
    binding: string | undefined,
  ): OAuthFlowState {
    const { hasher, clock } = this.ports;
    const flow = state === undefined ? undefined : this.ports.state.read(state);
    if (
      flow === undefined ||
      binding === undefined ||
      flow.provider !== provider ||
      flow.expiresAtMs <= clock.now().getTime() ||
      !hasher.matches(binding, flow.bindingHash)
    ) {
      throw new OAuthFailedError();
    }
    return flow;
  }

  /** Subject first, so a changed email still finds the account; only then does the email come into it. */
  private async settle(ctx: OperationContext, identity: OAuthIdentity, bindingHash: string): Promise<OAuthCompletion> {
    if (identity.email !== null) {
      await this.ports.claims.claim(ctx, identity.email);
    }
    await this.ports.claims.claim(ctx, subjectClaim(identity));
    const known = await this.accountOfSubject(ctx, identity);
    if (known !== undefined) {
      return { destination: 'sign-in', ticket: await this.issue(ctx, known.userId, bindingHash) };
    }
    const holder = identity.email === null ? undefined : await this.ports.identity.findByEmail(ctx, identity.email);
    if (holder === undefined) {
      return { destination: 'register', ticket: await this.issueForNewIdentity(ctx, identity, bindingHash) };
    }
    assertLinkable(identity, holder);
    await this.ports.external.link(ctx, holder.userId, identity.provider, identity.subject);
    return { destination: 'sign-in', ticket: await this.issue(ctx, holder.userId, bindingHash) };
  }

  private async accountOfSubject(ctx: OperationContext, identity: OAuthIdentity): Promise<AccountRecord | undefined> {
    const userId = await this.ports.external.findUserId(ctx, identity.provider, identity.subject);
    return userId === undefined ? undefined : this.ports.identity.findByUserId(ctx, userId);
  }

  private async issue(ctx: OperationContext, userId: number, bindingHash: string): Promise<string> {
    const payload: OAuthTicketPayload = { bindingHash, identity: null };
    const { token } = await this.ports.tokens.issue(ctx, {
      userId,
      purpose: 'oauth-ticket',
      ttlMs: OAUTH_TICKET_TTL_MS,
      payload: { ...payload },
    });
    return token;
  }

  private async issueForNewIdentity(
    ctx: OperationContext,
    identity: OAuthIdentity,
    bindingHash: string,
  ): Promise<string> {
    const payload: OAuthTicketPayload = { bindingHash, identity };
    const { token } = await this.ports.tokens.issue(ctx, {
      userId: null,
      purpose: 'oauth-ticket',
      ttlMs: OAUTH_TICKET_TTL_MS,
      payload: { ...payload },
    });
    return token;
  }

  private payloadOf(row: AccountToken): OAuthTicketPayload {
    return row.payload as unknown as OAuthTicketPayload;
  }

  private identityOf(row: AccountToken): OAuthIdentity {
    const { identity } = this.payloadOf(row);
    if (row.userId !== null || identity === null) {
      throw new InvalidTokenError();
    }
    return identity;
  }
}

/** The key that serialises everything claiming one provider subject; there is no unique index to lean on (D41). */
function subjectClaim(identity: OAuthIdentity): string {
  return `oauth:${identity.provider}:${identity.subject}`;
}

/**
 * Linking hands the account to whoever holds the provider login. Both sides must have proven the address, or a
 * pre-set password or a provider account with someone else's email would take the account over. A platform
 * administrator is never linked: social sign-in must not reach that role.
 */
function assertLinkable(identity: OAuthIdentity, holder: AccountRecord): void {
  if (!identity.emailVerified || holder.emailVerifiedAt === null || holder.businessId === null) {
    throw new OAuthLinkRequiresVerificationError();
  }
}
