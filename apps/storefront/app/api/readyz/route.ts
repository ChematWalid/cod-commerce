import { connection } from 'next/server';
import { internalApiUrl } from '../../../src/config/storefront-env';
import { checkNodeReadiness } from '../../../src/health/node-readiness';

/**
 * Node-level readiness for the load balancer: 200 only while this storefront and the api on the same node are
 * ready, 503 otherwise (a draining api included). Outside the proxy's matcher (`api/`), so any Host reaches it.
 */
export async function GET(): Promise<Response> {
  await connection();
  const { statusCode, body } = await checkNodeReadiness(internalApiUrl);
  return Response.json(body, { status: statusCode, headers: { 'cache-control': 'no-store' } });
}
