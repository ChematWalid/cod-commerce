import { revalidateTag } from 'next/cache';
import { internalVerifyKeys } from '../../../../src/config/storefront-env';
import { handleRevalidate } from '../../../../src/revalidate/handle-revalidate';

const MS_PER_SECOND = 1000;
/** Next's longest-lived revalidation profile: the entry is refetched on its next read (stale-while-revalidate). */
const REVALIDATE_PROFILE = 'max';

/**
 * The api's revalidate worker expires storefront cache tags here (ADR 0006, D3211). The HMAC signature is the gate;
 * the proxy matcher skips `api/`, so the edge rule of P3.S5 is what keeps buyers from even reaching it.
 */
export async function POST(request: Request): Promise<Response> {
  return handleRevalidate(request, {
    keys: internalVerifyKeys,
    nowSeconds: () => Date.now() / MS_PER_SECOND,
    revalidate: (tag) => {
      revalidateTag(tag, REVALIDATE_PROFILE);
    },
    refused: (reason) => {
      console.warn(JSON.stringify({ level: 'warn', event: 'storefront.revalidate.refused', reason }));
    },
  });
}
