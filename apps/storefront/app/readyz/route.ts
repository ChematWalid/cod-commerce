import { connection } from 'next/server';
import { toStorefrontReadiness } from '../../src/health/readiness';
import { pingRedis } from '../../src/health/redis-ping';

/** Readiness: always 200, with the Valkey check in the body (see `toStorefrontReadiness`). */
export async function GET(): Promise<Response> {
  await connection();
  const readiness = toStorefrontReadiness(await pingRedis());
  return Response.json(readiness, { headers: { 'cache-control': 'no-store' } });
}
