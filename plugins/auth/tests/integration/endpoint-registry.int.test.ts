import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_ROUTES, type RouteEntry } from './endpoint-registry';
import { createOAuthTestKit } from './oauth-test-kit';
import { uniqueIp } from './register-test-kit';

// The OAuth flag is on, so its routes answer for their fixture instead of a flag-off 404.
const kit = createOAuthTestKit();

interface RouteAnswer {
  readonly status: number;
  readonly code: string | undefined;
}

/** Sends a route's fixture as a signed-out caller. A redirect is the answer, not followed. */
async function send({ method, url, body }: RouteEntry): Promise<RouteAnswer> {
  const response = await fetch(kit.client.url(url), {
    method,
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'x-test-client-ip': uniqueIp() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = (await response.json().catch(() => null)) as { code?: unknown } | null;
  return { status: response.status, code: typeof parsed?.code === 'string' ? parsed.code : undefined };
}

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.stop();
});

describe('the public REST routes of the endpoint registry', () => {
  it.each(PUBLIC_ROUTES)('$method $route answers its fixture as the registry expects', async (entry) => {
    // Act
    const answer = await send(entry);

    // Assert
    expect(answer).toEqual({ status: entry.answer?.status, code: entry.answer?.code });
  });
});
