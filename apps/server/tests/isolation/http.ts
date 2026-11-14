/**
 * A small HTTP client for the P1 isolation matrix. It speaks to a running api, an e2e test server or the evidence
 * stack, and keeps every exchange so the evidence can print it. Session tokens never reach a transcript: the
 * printed request names the session, not its token.
 */

/** Vendure's default header names. */
export const AUTH_TOKEN_HEADER = 'vendure-auth-token';
export const CHANNEL_TOKEN_HEADER = 'vendure-token';

/** Who sends a request: a named, signed-in session, or nobody. */
export interface Caller {
  readonly label: string;
  readonly token?: string;
}

/** A request as the matrix describes it; `channelToken` selects the store, as the dashboard does. */
export interface MatrixRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** `/admin-api` for GraphQL, or a REST path. */
  readonly path: string;
  readonly caller: Caller;
  /** The store the request names, by its label in the world (for the transcript) and its token. */
  readonly channel?: { readonly label: string; readonly token: string };
  /** A JSON body; or, with `rawBody`, the exact bytes sent (a signed webhook). */
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** A file sent as a GraphQL multipart upload at `variables.file`; `body` then holds the query and variables. */
  readonly upload?: UploadedFile;
}

/** A file as a client uploads it: its bytes and the name it claims. */
export interface UploadedFile {
  readonly bytes: Buffer;
  readonly name: string;
}

/** The type every upload claims; the server reads the bytes, never the claim. */
const CLAIMED_TYPE = 'image/png';

/** What came back, with the body parsed when it is JSON. */
export interface Exchange {
  readonly request: MatrixRequest;
  readonly status: number;
  readonly body: unknown;
}

/** GraphQL's answer shape. */
export interface GraphqlBody {
  readonly data?: Record<string, unknown> | null;
  readonly errors?: readonly { readonly message: string; readonly extensions?: { readonly code?: string } }[];
}

/** Sends matrix requests to one api base URL. */
export class IsolationHttp {
  constructor(private readonly baseUrl: string) {}

  /** Sends `request` and returns the exchange. */
  async send(request: MatrixRequest): Promise<Exchange> {
    if (request.upload !== undefined) return this.sendUpload(request, request.upload);
    const headers: Record<string, string> = { ...request.headers };
    const body = request.rawBody ?? (request.body === undefined ? undefined : JSON.stringify(request.body));
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(new URL(request.path, this.baseUrl), {
      method: request.method,
      headers: { ...headers, ...this.sessionHeaders(request) },
      body,
    });
    const text = await response.text();
    return { request, status: response.status, body: parseBody(text) };
  }

  /** A GraphQL multipart upload of one file as `$file` (the logo upload, the catalog's media). */
  upload(caller: Caller, query: string, file: UploadedFile, channel: NonNullable<MatrixRequest['channel']>) {
    const body = { query, variables: { file: null } };
    return this.send({ method: 'POST', path: '/admin-api', caller, channel, body, upload: file });
  }

  private async sendUpload(request: MatrixRequest, file: UploadedFile): Promise<Exchange> {
    const form = new FormData();
    form.append('operations', JSON.stringify(request.body));
    form.append('map', JSON.stringify({ 0: ['variables.file'] }));
    form.append('0', new Blob([new Uint8Array(file.bytes)], { type: CLAIMED_TYPE }), file.name);
    const response = await fetch(new URL(request.path, this.baseUrl), {
      method: 'POST',
      // Apollo refuses a multipart request without this header (its CSRF prevention).
      headers: { 'apollo-require-preflight': 'true', ...request.headers, ...this.sessionHeaders(request) },
      body: form,
    });
    return { request, status: response.status, body: parseBody(await response.text()) };
  }

  private sessionHeaders(request: MatrixRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    if (request.caller.token !== undefined) headers['authorization'] = `Bearer ${request.caller.token}`;
    if (request.channel !== undefined) headers[CHANNEL_TOKEN_HEADER] = request.channel.token;
    return headers;
  }

  /** A GraphQL call to the Admin API. */
  graphql(
    caller: Caller,
    query: string,
    variables: Record<string, unknown> = {},
    channel?: MatrixRequest['channel'],
  ): Promise<Exchange> {
    return this.send({ method: 'POST', path: '/admin-api', caller, channel, body: { query, variables } });
  }

  /** Signs in with a password and returns the session. @throws Error when the credentials are refused. */
  async login(label: string, username: string, password: string): Promise<Caller> {
    const response = await fetch(new URL('/admin-api', this.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: LOGIN, variables: { username, password } }),
    });
    const token = response.headers.get(AUTH_TOKEN_HEADER);
    if (token === null) throw new Error(`login refused for ${label}: ${await response.text()}`);
    return { label, token };
  }
}

const LOGIN = `mutation ($username: String!, $password: String!) {
  login(username: $username, password: $password) { __typename ... on ErrorResult { errorCode message } }
}`;

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** The data of a GraphQL exchange. @throws Error when the call failed, naming its first error. */
export function dataOf(exchange: Exchange): Record<string, unknown> {
  const body = exchange.body as GraphqlBody;
  if (body.errors !== undefined && body.errors.length > 0) {
    throw new Error(`GraphQL error: ${body.errors[0]?.message ?? ''} (${body.errors[0]?.extensions?.code ?? ''})`);
  }
  return body.data ?? {};
}

/** One field of a GraphQL exchange's data. @throws Error when the call failed. */
export const fieldOf = (exchange: Exchange, field: string): unknown => dataOf(exchange)[field];

/** The error codes of a GraphQL exchange, in order. */
export const errorCodesOf = (exchange: Exchange): string[] =>
  ((exchange.body as GraphqlBody).errors ?? []).map((error) => error.extensions?.code ?? 'NO_CODE');
