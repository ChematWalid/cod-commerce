import { Logger } from '@vendure/core';
import { CHALLENGE_TIMEOUT_MS } from '../domain/constants';
import type { BotChallengeOutcome, BotChallengePort } from '../domain/ports/bot-challenge.port';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const LOG_CONTEXT = 'TurnstileBotChallenge';
const FIRST_CLIENT_ERROR_STATUS = 400;
const FIRST_SERVER_ERROR_STATUS = 500;
const INTERNAL_ERROR_CODE = 'internal-error';
/** These mean our configuration is wrong, not the visitor's token. */
const SECRET_ERROR_CODES = ['missing-input-secret', 'invalid-input-secret'];

/** The fields of a siteverify answer this adapter reads; the provider sends JSON on every status. */
interface SiteverifyAnswer {
  readonly success?: unknown;
  readonly 'error-codes'?: unknown;
}

async function readAnswer(response: Response): Promise<SiteverifyAnswer | undefined> {
  try {
    return (await response.json()) as SiteverifyAnswer;
  } catch (error) {
    Logger.warn(`Turnstile answer is not JSON: ${(error as Error).name}`, LOG_CONTEXT);
    return undefined;
  }
}

function errorCodesOf(answer: SiteverifyAnswer): readonly unknown[] {
  const codes = answer['error-codes'];
  return Array.isArray(codes) ? codes : [];
}

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
    return this.classify(response.status, await readAnswer(response));
  }

  /** Only the provider's own failure lets a sign-up through; a refused token or request does not. */
  private classify(status: number, answer: SiteverifyAnswer | undefined): BotChallengeOutcome {
    if (status >= FIRST_SERVER_ERROR_STATUS) {
      Logger.error(`Turnstile answered ${String(status)}`, LOG_CONTEXT);
      return 'unavailable';
    }
    if (answer === undefined) {
      Logger.error(`Turnstile sent an unreadable answer with status ${String(status)}`, LOG_CONTEXT);
      return status < FIRST_CLIENT_ERROR_STATUS ? 'unavailable' : 'failed';
    }
    const codes = errorCodesOf(answer);
    if (codes.includes(INTERNAL_ERROR_CODE)) {
      Logger.error('Turnstile reported an internal error', LOG_CONTEXT);
      return 'unavailable';
    }
    const secretErrors = SECRET_ERROR_CODES.filter((code) => codes.includes(code));
    if (secretErrors.length > 0) {
      Logger.error(`Turnstile refused our secret key: ${secretErrors.join(', ')}`, LOG_CONTEXT);
    }
    return status < FIRST_CLIENT_ERROR_STATUS && answer.success === true ? 'passed' : 'failed';
  }
}
