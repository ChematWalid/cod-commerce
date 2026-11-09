import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** What the fake provider says about the person signing in, in its own field names. */
export type ProviderProfile = Readonly<Record<string, unknown>>;

interface IssuedCode {
  readonly provider: string;
  readonly profile: ProviderProfile;
  readonly challenge: string;
  readonly redirectUri: string;
}

/** The credentials the test server is configured with; the mock refuses any others. */
export const MOCK_CLIENT_SECRET = 'synthetic-client-secret';

const readBody = async (request: IncomingMessage): Promise<URLSearchParams> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
};

const sendJson = (response: ServerResponse, status: number, body: object): void => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

const challengeOf = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

/** A provider on a local port: codes are single-use and PKCE and the redirect URI are really checked. */
export class MockOAuthServer {
  private server: Server | undefined;
  private readonly codes = new Map<string, IssuedCode>();
  private readonly accessTokens = new Map<string, ProviderProfile>();
  /** How many times the token endpoint was reached, to prove a rejected callback exchanged nothing. */
  tokenRequests = 0;

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve) => this.server?.listen(0, resolve));
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => this.server?.close(resolve));
  }

  get baseUrl(): string {
    return `http://localhost:${String((this.server?.address() as AddressInfo).port)}`;
  }

  /** The provider's consent screen: the person agrees, and the browser would be sent back with this code. */
  approve(provider: string, authorizeUrl: URL, profile: ProviderProfile): string {
    const code = randomUUID();
    this.codes.set(code, {
      provider,
      profile,
      challenge: authorizeUrl.searchParams.get('code_challenge') ?? '',
      redirectUri: authorizeUrl.searchParams.get('redirect_uri') ?? '',
    });
    return code;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', this.baseUrl);
    if (url.pathname.endsWith('/token')) {
      this.exchange(await readBody(request), response);
      return;
    }
    const token = (request.headers.authorization ?? '').replace('Bearer ', '');
    const profile = this.accessTokens.get(token);
    sendJson(response, profile === undefined ? 401 : 200, profile ?? { error: 'invalid_token' });
  }

  private exchange(form: URLSearchParams, response: ServerResponse): void {
    this.tokenRequests += 1;
    const code = form.get('code') ?? '';
    const issued = this.codes.get(code);
    this.codes.delete(code);
    const valid =
      issued !== undefined &&
      form.get('client_secret') === MOCK_CLIENT_SECRET &&
      form.get('redirect_uri') === issued.redirectUri &&
      challengeOf(form.get('code_verifier') ?? '') === issued.challenge;
    if (!valid) {
      sendJson(response, 400, { error: 'invalid_grant' });
      return;
    }
    const accessToken = randomUUID();
    this.accessTokens.set(accessToken, issued.profile);
    sendJson(response, 200, { access_token: accessToken, token_type: 'bearer' });
  }
}
