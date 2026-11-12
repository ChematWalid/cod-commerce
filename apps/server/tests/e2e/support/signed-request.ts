import { request } from 'node:http';
import { signInternalRequest, type InternalRequest, type InternalSigningKey } from '@cod/shared/internal-auth';

/** What a raw HTTP call to the api needs. */
export interface RawRequest {
  readonly port: number;
  readonly method: string;
  /** The path and query exactly as sent. */
  readonly path: string;
  /** The `Host` header; the one the tests vary, which `fetch` would not let them set. */
  readonly host: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

/** The part of the answer the tests look at. */
export interface RawResponse {
  readonly status: number;
  readonly body: string;
  /** Lower-case header names. */
  readonly headers: Readonly<Record<string, string | undefined>>;
}

/** Sends one request with exactly the headers given, so a test controls the `Host` and every signed header. */
export function sendRaw(options: RawRequest): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: options.port,
        method: options.method,
        path: options.path,
        headers: {
          host: options.host,
          ...(options.body === undefined ? {} : { 'content-length': String(Buffer.byteLength(options.body)) }),
          ...options.headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([name, value]) => [
                name,
                Array.isArray(value) ? value.join(',') : value,
              ]),
            ),
          });
        });
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}

/** The signed fields of one call: the store, client address and country the signature covers. */
export interface SignedContext {
  readonly storeId?: string;
  readonly clientIp?: string;
  readonly clientCountry?: string;
}

/** The `x-internal-*` headers (and the covered `x-store-id`, `x-client-ip`, `x-client-country`) for a request. */
export function signedHeaders(
  key: InternalSigningKey,
  call: Pick<RawRequest, 'method' | 'path' | 'body'>,
  context: SignedContext = {},
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Record<string, string> {
  const covered: InternalRequest = { method: call.method, pathWithQuery: call.path, body: call.body ?? '', ...context };
  return { ...signInternalRequest(covered, key, nowSeconds) };
}
