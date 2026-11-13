import { RateLimitedError, RateLimiter, type RateLimitPolicyName } from '@cod/plugin-rate-limit';
import { Injectable } from '@nestjs/common';
import type { TeamActor } from '../domain/team-actor';

/** Caps the invitation mail one business and one administrator can make the platform send (D205). */
@Injectable()
export class TeamThrottle {
  constructor(private readonly limiter: RateLimiter) {}

  /**
   * The narrower actor budget is spent first, so one administrator past its own cap is refused before
   * its calls can drain the budget the whole business shares.
   *
   * @throws RateLimitedError (429) past the actor's or the business's invitation budget.
   */
  async spendInvite(actor: TeamActor): Promise<void> {
    await this.spend('team-invite-actor', actorKeyOf(actor));
    await this.spend('team-invite-business', actor.scope.businessId);
  }

  /** @throws RateLimitedError (429) past the actor's resend budget. */
  async spendResend(actor: TeamActor): Promise<void> {
    await this.spend('team-resend-actor', actorKeyOf(actor));
  }

  private async spend(policy: RateLimitPolicyName, key: string): Promise<void> {
    const decision = await this.limiter.consume(policy, key);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
  }
}

/** An administrator acts for one business, but its id says which one only with the business. */
export const actorKeyOf = (actor: Pick<TeamActor, 'administratorId' | 'scope'>): string =>
  `${actor.scope.businessId}:${String(actor.administratorId)}`;
