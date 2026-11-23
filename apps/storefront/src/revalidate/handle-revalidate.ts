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

/** Why a body cannot be read, or the body as text. */
type BodyRead = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: string };

const unreadable = (reason: string): BodyRead => ({ ok: false, reason });

/**
 * Reads at most {@link REVALIDATE_MAX_BODY_BYTES} of an unverified body. A missing Content-Length (a chunked body) is
 * refused before anything is read, since the api's revalidator always sends one, and the stream is cancelled as soon
 * as the running length passes the limit, whatever was declared, so a caller can never make the route buffer more.
 */
async function cappedBody(request: Request): Promise<BodyRead> {
  const declared = request.headers.get('content-length');
  if (declared === null) return unreadable('the body has no content length');
  if (Number(declared) > REVALIDATE_MAX_BODY_BYTES) return unreadable('the body is over the limit');
  if (request.body === null) return { ok: true, text: '' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    length += next.value.byteLength;
    if (length > REVALIDATE_MAX_BODY_BYTES) {
      await reader.cancel();
      return unreadable('the body is over the limit');
    }
    chunks.push(next.value);
  }
  return { ok: true, text: new TextDecoder().decode(concatenated(chunks, length)) };
}

function concatenated(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
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
  const read = await cappedBody(request);
  const refusal = read.ok ? refusalOf(request, read.text, deps) : read.reason;
  if (refusal !== undefined || !read.ok) {
    deps.refused(refusal ?? 'no body');
    return empty(STATUS_NOT_FOUND);
  }
  const tags = tagsOf(read.text);
  if (tags === undefined) return empty(STATUS_BAD_REQUEST);
  for (const tag of tags) deps.revalidate(tag);
  return empty(STATUS_OK);
}
