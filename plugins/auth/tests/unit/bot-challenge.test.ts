import { Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotChallengePort } from '../../domain/ports/bot-challenge.port';
import { NoopBotChallenge } from '../../infrastructure/noop-bot-challenge';
import { TurnstileBotChallenge } from '../../infrastructure/turnstile-bot-challenge';

const SECRET = 'synthetic-turnstile-secret';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it('asks the provider at its own address unless another one is configured', async () => {
    // Arrange
    const fetchMock = stubFetch(new Response(JSON.stringify({ success: true })));
    const override = 'http://turnstile-mock.test:8080/siteverify';

    // Act
    await new TurnstileBotChallenge(SECRET).verify('token');
    await new TurnstileBotChallenge(SECRET, undefined).verify('token');
    await new TurnstileBotChallenge(SECRET, override).verify('token');

    // Assert
    expect(fetchMock.mock.calls.map(([url]) => url as unknown)).toEqual([
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      override,
    ]);
  });

  it('fails when the provider refuses the token', async () => {
    // Arrange
    stubFetch(new Response(JSON.stringify({ success: false })));

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('failed');
  });

  it.each([
    ['a 400 with a bad token', 400, { success: false, 'error-codes': ['invalid-input-response'] }],
    ['a 200 with a spent token', 200, { success: false, 'error-codes': ['timeout-or-duplicate'] }],
    ['a 400 claiming success', 400, { success: true }],
  ])('fails on %s', async (_name, status, answer) => {
    // Arrange
    stubFetch(new Response(JSON.stringify(answer), { status }));

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('failed');
  });

  it('fails on a 4xx whose body is not JSON', async () => {
    // Arrange
    stubFetch(new Response('refused', { status: 403 }));

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('failed');
  });

  it.each(['invalid-input-secret', 'missing-input-secret'])('logs %s at error level and fails', async (code) => {
    // Arrange
    stubFetch(new Response(JSON.stringify({ success: false, 'error-codes': [code] }), { status: 400 }));
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('failed');
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(code), expect.anything());
    expect(JSON.stringify(logged.mock.calls)).not.toContain(SECRET);
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
    ['a server error with JSON', new Response(JSON.stringify({ success: false }), { status: 500 })],
    ['a provider internal error', new Response(JSON.stringify({ success: false, 'error-codes': ['internal-error'] }))],
  ])('reports the provider unavailable on %s', async (_name, result) => {
    // Arrange
    stubFetch(result);

    // Act
    const outcome = await new TurnstileBotChallenge(SECRET).verify('token');

    // Assert
    expect(outcome).toBe('unavailable');
  });
});
