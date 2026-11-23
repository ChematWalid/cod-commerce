import { request } from 'node:http';

/** The status, headers and body of one plain HTTP response. */
export interface HttpResult {
  readonly status: number;
  readonly body: string;
  /** Lower-case header names; a repeated header joined by a comma. */
  readonly headers: Readonly<Record<string, string | undefined>>;
}

/** What a request sends besides its URL and `Host`. */
export interface HttpRequestOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

/** The storefront under test (`STOREFRONT_URL`); a host-run `next start` by default. */
export const STOREFRONT_URL = process.env['STOREFRONT_URL'] ?? 'http://127.0.0.1:3001';

const POLL_INTERVAL_MS = 1000;

const headersOf = (raw: NodeJS.Dict<string | string[]>): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(raw).map(([name, value]) => [name, Array.isArray(value) ? value.join(',') : value]),
  );

/**
 * A request with an explicit `Host` header, over `node:http` (fetch does not let a caller set `Host`). `url` is sent
 * as written, so a path such as `//_t/…` reaches the server unchanged.
 */
export function httpRequestWithHost(url: string, host: string, options: HttpRequestOptions = {}): Promise<HttpResult> {
  const { method = 'GET', headers = {}, body } = options;
  const length = body === undefined ? {} : { 'content-length': String(Buffer.byteLength(body)) };
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers: { ...headers, ...length, host } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
          headers: headersOf(res.headers),
        });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * A GET with an explicit `Host` header.
 *
 * @param headers extra request headers, e.g. a spoofed `X-Forwarded-Host`
 */
export function httpGetWithHost(url: string, host: string, headers: Record<string, string> = {}): Promise<HttpResult> {
  return httpRequestWithHost(url, host, { headers });
}

/** Polls `url` until it answers `status`, like `scripts/lib/wait-http.sh`'s `wait_http`. */
export async function waitForHttp(url: string, status: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const result = await httpGetWithHost(url, new URL(url).host);
      if (result.status === status) return;
      last = `status ${String(result.status)}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`${url} did not answer ${String(status)} within ${String(timeoutMs)} ms (last: ${last})`);
}
