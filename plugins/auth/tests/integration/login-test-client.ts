import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';

const AUTH_TOKEN_HEADER = 'vendure-auth-token';
const LOGIN = `mutation ($username: String!, $password: String!) {
  login(username: $username, password: $password) {
    __typename
    ... on CurrentUser { identifier }
    ... on ErrorResult { errorCode }
  }
}`;
const ME = 'query { me { identifier } }';
const LOGOUT = 'mutation { logout { success } }';

/** Who a request is sent as. */
export interface Caller {
  readonly ip?: string;
  readonly token?: string;
  readonly cookie?: string;
  readonly language?: string;
  /** The `vendure-token` of the channel the request is for. */
  readonly channelToken?: string;
}

interface GraphqlError {
  readonly message: string;
  readonly extensions?: { readonly code?: string; readonly retryAfterSeconds?: number };
}

/** A parsed GraphQL answer and the headers around it. */
export interface GraphqlAnswer {
  readonly data: Record<string, Record<string, unknown> | null> | null;
  readonly errors: readonly GraphqlError[];
  readonly headers: Headers;
}

/** A file to send, with the type and name a client claims for it. */
export interface UploadedTestFile {
  readonly bytes: Uint8Array;
  readonly claimedType: string;
  readonly name: string;
}

/** The outcome of a `login`: `OK`, an error result code or a thrown error's code. */
export interface LoginOutcome {
  readonly code: string;
  readonly message: string | undefined;
  readonly retryAfterSeconds: number | undefined;
  readonly retryAfterHeader: string | null;
  readonly token: string | null;
  readonly cookie: string;
}

/** The `name=value` pairs of the response's cookies, as a `Cookie` request header. */
const cookiesOf = (headers: Headers): string =>
  headers
    .getSetCookie()
    .map((line) => line.split(';')[0] ?? '')
    .join('; ');

/** `json` false leaves `content-type` out, for a multipart body whose boundary `fetch` writes itself. */
function headersFor(caller: Caller, json = true): Record<string, string> {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    ...(caller.ip === undefined ? {} : { 'x-test-client-ip': caller.ip }),
    ...(caller.token === undefined ? {} : { authorization: `Bearer ${caller.token}` }),
    ...(caller.cookie === undefined ? {} : { cookie: caller.cookie }),
    ...(caller.language === undefined ? {} : { 'accept-language': caller.language }),
    ...(caller.channelToken === undefined ? {} : { 'vendure-token': caller.channelToken }),
  };
}

/** Raw HTTP against the test server: the assertions need status, headers and error extensions. */
export class LoginTestClient {
  constructor(private readonly app: () => INestApplication) {}

  url(path: string): string {
    const address = (this.app().getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(address.port)}${path}`;
  }

  rest(path: string, body: object, caller: Caller = {}): Promise<Response> {
    return fetch(this.url(path), { method: 'POST', headers: headersFor(caller), body: JSON.stringify(body) });
  }

  async graphql(query: string, variables: object = {}, caller: Caller = {}): Promise<GraphqlAnswer> {
    const response = await this.rest('/admin-api', { query, variables }, caller);
    const body = (await response.json()) as Pick<GraphqlAnswer, 'data'> & { errors?: GraphqlError[] };
    return { data: body.data, errors: body.errors ?? [], headers: response.headers };
  }

  /** A JSON request of any method, answered with the status and the parsed body. */
  async json(method: string, path: string, caller: Caller, body?: object): Promise<{ status: number; body: unknown }> {
    const response = await fetch(this.url(path), {
      method,
      headers: headersFor(caller),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }

  /** A GraphQL multipart request (the `graphql-multipart-request-spec`) with one file at `variables.file`. */
  async upload(query: string, file: UploadedTestFile, caller: Caller = {}): Promise<GraphqlAnswer> {
    const form = new FormData();
    form.set('operations', JSON.stringify({ query, variables: { file: null } }));
    form.set('map', JSON.stringify({ '0': ['variables.file'] }));
    form.set('0', new Blob([file.bytes], { type: file.claimedType }), file.name);
    const response = await fetch(this.url('/admin-api'), {
      method: 'POST',
      headers: headersFor(caller, false),
      body: form,
    });
    const body = (await response.json()) as Pick<GraphqlAnswer, 'data'> & { errors?: GraphqlError[] };
    return { data: body.data, errors: body.errors ?? [], headers: response.headers };
  }

  async login(username: string, password: string, caller: Caller): Promise<LoginOutcome> {
    const answer = await this.graphql(LOGIN, { username, password }, caller);
    const error = answer.errors[0];
    const result = answer.data?.['login'];
    return {
      code: error?.extensions?.code ?? (result?.['errorCode'] as string | undefined) ?? 'OK',
      message: error?.message,
      retryAfterSeconds: error?.extensions?.retryAfterSeconds,
      retryAfterHeader: answer.headers.get('retry-after'),
      token: answer.headers.get(AUTH_TOKEN_HEADER),
      cookie: cookiesOf(answer.headers),
    };
  }

  /** The caller's identifier, or the error code `me` answers with. */
  async me(caller: Caller): Promise<string> {
    const answer = await this.graphql(ME, {}, caller);
    return (
      (answer.data?.['me']?.['identifier'] as string | undefined) ?? answer.errors[0]?.extensions?.code ?? 'NO_USER'
    );
  }

  logout(caller: Caller): Promise<GraphqlAnswer> {
    return this.graphql(LOGOUT, {}, caller);
  }
}

export { AUTH_TOKEN_HEADER };
