import { Logger } from '@vendure/core';
import { CHALLENGE_TIMEOUT_MS } from '../domain/constants';
import type { BotChallengeOutcome, BotChallengePort } from '../domain/ports/bot-challenge.port';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const LOG_CONTEXT = 'TurnstileBotChallenge';

/** Server-side check of a Turnstile response. An outage lets sign-ups through and logs an error (D35). */
export class TurnstileBotChallenge implements BotChallengePort {
  constructor(private readonly secretKey: string) {}

  async verify(token: string | undefined): Promise<BotChallengeOutcome> {
    if (token === undefined || token === '') {
      return 'failed';
    }
    try {
      return await this.askProvider(token);
    } catch (error) {
      Logger.error(`Turnstile unreachable: ${(error as Error).name}`, LOG_CONTEXT);
      return 'unavailable';
    }
  }

  private async askProvider(token: string): Promise<BotChallengeOutcome> {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: this.secretKey, response: token }),
      signal: AbortSignal.timeout(CHALLENGE_TIMEOUT_MS),
    });
    if (!response.ok) {
      Logger.error(`Turnstile answered ${String(response.status)}`, LOG_CONTEXT);
      return 'unavailable';
    }
    const { success } = (await response.json()) as { readonly success?: unknown };
    return success === true ? 'passed' : 'failed';
  }
}
