import { ClientIpResolver, type ClientRequest, RateLimitedError, RateLimiter } from '@cod/plugin-rate-limit';
import { normalizeEmail } from '@cod/shared';
import type { Type } from '@nestjs/common';
import {
  type Injector,
  type NativeAuthenticationData,
  NativeAuthenticationStrategy,
  type RequestContext,
  type User,
} from '@vendure/core';
import { SECRET_HASHER } from '../application/tokens';
import { LOGIN_RATE_LIMITED_MESSAGE } from '../domain/constants';
import { loginEmailKey, loginPairKey } from '../domain/login-throttle-keys';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';

const NO_CLIENT: ClientRequest = { ip: undefined, headers: {} };
const RETRY_AFTER_HEADER = 'Retry-After';

/** Who is attempting a login, in the forms the limiter keys by. */
interface LoginAttempt {
  readonly ctx: RequestContext;
  readonly emailKey: string;
  readonly ip: string;
  readonly pairKey: string;
}

/**
 * The stock password check behind the limits of D29. Every limit behaves the same for an unknown email, so the
 * answers cannot reveal which accounts exist. Only a lockout of this exact account-and-address pair blocks a
 * correct password: anything keyed by email alone would let a stranger hold the owner out of their account.
 */
export class ThrottledNativeAuthenticationStrategy extends NativeAuthenticationStrategy {
  private limiter!: RateLimiter;
  private clientIp!: ClientIpResolver;
  private hasher!: SecretHasherPort;

  override async init(injector: Injector): Promise<void> {
    await super.init(injector);
    // Abstract, so it does not fit `Type<T>`; at runtime the class is the injection token.
    this.limiter = injector.get(RateLimiter as unknown as Type<RateLimiter>);
    this.clientIp = injector.get(ClientIpResolver);
    this.hasher = injector.get<SecretHasherPort>(SECRET_HASHER);
  }

  override async authenticate(ctx: RequestContext, data: NativeAuthenticationData): Promise<User | false> {
    const attempt = this.attemptOf(ctx, data);
    await this.refuseIfOverLimit(attempt);
    // Trim only: Vendure lowercases an email itself and must keep the case of a non-email username.
    const user = await super.authenticate(ctx, { ...data, username: data.username.trim() });
    if (user === false) {
      await this.recordFailure(attempt);
      return false;
    }
    await this.limiter.clearLockout(attempt.pairKey);
    return user;
  }

  private attemptOf(ctx: RequestContext, data: NativeAuthenticationData): LoginAttempt {
    const emailKey = loginEmailKey(this.hasher, normalizeEmail(data.username));
    const ip = this.clientIp.resolve(ctx.req ?? NO_CLIENT);
    return { ctx, emailKey, ip, pairKey: loginPairKey(emailKey, ip) };
  }

  private async refuseIfOverLimit(attempt: LoginAttempt): Promise<void> {
    const lock = await this.limiter.isLocked(attempt.pairKey);
    if (lock.locked) {
      this.refuse(attempt.ctx, lock.retryAfterSeconds);
    }
    const perAddress = await this.limiter.consume('login-ip', attempt.ip);
    if (!perAddress.allowed) {
      this.refuse(attempt.ctx, perAddress.retryAfterSeconds);
    }
  }

  /**
   * Spending the pair's last token locks at once, so the attempt after the tenth failure is the one refused.
   * Only that call locks: every lockout doubles, so a refused call re-locking would let one burst reach the cap.
   */
  private async recordFailure(attempt: LoginAttempt): Promise<void> {
    const pair = await this.limiter.consume('login-pair', attempt.pairKey);
    if (pair.allowed && pair.exhausted) {
      await this.limiter.lockout(attempt.pairKey);
    }
    const account = await this.limiter.consume('login-account', attempt.emailKey);
    if (!account.allowed) {
      this.refuse(attempt.ctx, account.retryAfterSeconds);
    }
    if (!pair.allowed) {
      this.refuse(attempt.ctx, pair.retryAfterSeconds);
    }
  }

  /** Sets the header here because `login` is a stock resolver, which no plugin filter can be attached to (D30). */
  private refuse(ctx: RequestContext, retryAfterSeconds: number): never {
    ctx.req?.res?.setHeader(RETRY_AFTER_HEADER, String(retryAfterSeconds));
    throw new RateLimitedError(retryAfterSeconds, LOGIN_RATE_LIMITED_MESSAGE);
  }
}
