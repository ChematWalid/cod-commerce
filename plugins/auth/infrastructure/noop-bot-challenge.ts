import type { BotChallengeOutcome, BotChallengePort } from '../domain/ports/bot-challenge.port';

/** The challenge while `TURNSTILE_ENABLED` is false: any token, or none, passes (D35). */
export class NoopBotChallenge implements BotChallengePort {
  verify(): Promise<BotChallengeOutcome> {
    return Promise.resolve('passed');
  }
}
