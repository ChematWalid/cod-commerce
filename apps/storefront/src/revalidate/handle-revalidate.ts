import { storefrontRevalidateBodySchema } from '@cod/shared';
import { INTERNAL_AUTH_HEADERS, type InternalSigningKey, verifyInternalRequest } from '@cod/shared/internal-auth';

/** Largest body the route reads: 100 tags of at most 30 characters fit well below it. */
export const REVALIDATE_MAX_BODY_BYTES = 8_192;

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;

/** What the route runs with: the verifying keys, the clock, Next's `revalidateTag` and where refusals are logged. */
export interface RevalidateDeps {
  /** Every configured internal key: a call signed under any of them passes (rotation, D3202). */
  readonly keys: () => readonly InternalSigningKey[];
  readonly nowSeconds: () => number;
  readonly revalidate: (tag: string) => void;
  /** Records why a request was refused; the reason never holds a secret or the body. */
  readonly refused: (reason: string) => void;
}

const empty = (status: number): Response => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

/** The body as text, or `undefined` when it is larger than {@link REVALIDATE_MAX_BODY_BYTES}. */
async function cappedBody(request: Request): Promise<string | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > REVALIDATE_MAX_BODY_BYTES) return undefined;
  const bytes = new Uint8Array(await request.arrayBuffer());
  return bytes.byteLength > REVALIDATE_MAX_BODY_BYTES ? undefined : new TextDecoder().decode(bytes);
}

function headersOf(request: Request): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.values(INTERNAL_AUTH_HEADERS).map((name) => [name, request.headers.get(name) ?? undefined]),
  );
}

/** Why the request is not the api's, or `undefined` when its signature holds. */
function refusalOf(request: Request, body: string, deps: RevalidateDeps): string | undefined {
  let keys: readonly InternalSigningKey[];
  try {
    keys = deps.keys();
  } catch (error: unknown) {
    return `the internal keys are unusable (${error instanceof Error ? error.name : typeof error})`;
  }
  const url = new URL(request.url);
  const verified = verifyInternalRequest(
    { method: request.method, pathWithQuery: `${url.pathname}${url.search}`, body },
    headersOf(request),
    keys,
    deps.nowSeconds(),
  );
  return verified.ok ? undefined : `the signature check failed (${verified.reason})`;
}

/** The body's tags, each once, or `undefined` for a body that is not a revalidate body. */
function tagsOf(body: string): readonly string[] | undefined {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    // A body that is not JSON is answered 400 like any other malformed body; there is nothing to log.
    return undefined;
  }
  const parsed = storefrontRevalidateBodySchema.safeParse(json);
  return parsed.success ? [...new Set(parsed.data.tags)] : undefined;
}

/**
 * The storefront's `POST /api/internal/revalidate` (D3211): the api's revalidate worker expires cache tags here.
 * Anything that is not a signed `cod-internal-v1` call of the api answers an empty 404, as if the route did not exist
 * (the edge also blocks `/api/internal/*`, P3.S5); a signed call with a malformed body answers an empty 400.
 */
export async function handleRevalidate(request: Request, deps: RevalidateDeps): Promise<Response> {
  const body = await cappedBody(request);
  const refusal = body === undefined ? 'the body is over the limit' : refusalOf(request, body, deps);
  if (refusal !== undefined || body === undefined) {
    deps.refused(refusal ?? 'no body');
    return empty(STATUS_NOT_FOUND);
  }
  const tags = tagsOf(body);
  if (tags === undefined) return empty(STATUS_BAD_REQUEST);
  for (const tag of tags) deps.revalidate(tag);
  return empty(STATUS_OK);
}
