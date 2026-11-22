import { connection } from 'next/server';
import { toStorefrontReadiness } from '../../src/health/readiness';
import { pingRedis } from '../../src/health/redis-ping';

/**
 * Readiness: always 200, with the Valkey check in the body (see `toStorefrontReadiness`). Anyone can call it,
 * so a failed check says only `reason: 'cache_unreachable'`; the error text goes to the log (#184).
 */
export async function GET(): Promise<Response> {
  await connection();
  const readiness = toStorefrontReadiness(await pingRedis());
  return Response.json(readiness, { headers: { 'cache-control': 'no-store' } });
}
