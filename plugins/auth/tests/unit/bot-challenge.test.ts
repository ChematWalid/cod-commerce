import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotChallengePort } from '../../domain/ports/bot-challenge.port';
import { NoopBotChallenge } from '../../infrastructure/noop-bot-challenge';
import { TurnstileBotChallenge } from '../../infrastructure/turnstile-bot-challenge';

const SECRET = 'synthetic-turnstile-secret';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(result: Response | Error): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('NoopBotChallenge', () => {
  it('passes with or without a token', async () => {
    // Arrange
    const challenge: BotChallengePort = new NoopBotChallenge();

    // Act
    const answers = await Promise.all([challenge.verify(undefined), challenge.verify('anything')]);

    // Assert
    expect(answers).toEqual(['passed', 'passed']);
  });
});

describe('TurnstileBotChallenge', () => {
  it('passes when the provider confirms the token', async () => {
    // Arrange
    const fetchMock = stubFetch(new Response(JSON.stringify({ success: true })));

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('passed');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fails when the provider refuses the token', async () => {
    // Arrange
    stubFetch(new Response(JSON.stringify({ success: false })));

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('failed');
  });

  it('fails a missing token without calling the provider', async () => {
    // Arrange
    const fetchMock = stubFetch(new Response('{}'));

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify(undefined);

    // Assert
    expect(outcome).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a network failure', new Error('connect failed')],
    ['a server error', new Response('down', { status: 503 })],
    ['an unreadable answer', new Response('<html>')],
  ])('reports the provider unavailable on %s', async (_name, result) => {
    // Arrange
    stubFetch(result);

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('unavailable');
  });
});
