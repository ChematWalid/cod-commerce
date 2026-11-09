import { randomUUID } from 'node:crypto';
import { ExternalAuthenticationMethod, TransactionalConnection } from '@vendure/core';
import type { AuthOAuthOptions } from '../../auth.plugin';
import { type Caller, type GraphqlAnswer } from './login-test-client';
import { MOCK_CLIENT_SECRET, MockOAuthServer, type ProviderProfile } from './fixtures/mock-oauth-server';
import { createRegisterTestKit, type RegisterTestKit, uniqueIp } from './register-test-kit';

const AUTHENTICATE = `mutation ($ticket: String!) {
  authenticate(input: { oauth: { ticket: $ticket } }) {
    __typename
    ... on CurrentUser { identifier }
    ... on InvalidCredentialsError { authenticationError }
  }
}`;
const REGISTER_WITH_TICKET = `mutation ($input: RegisterMerchantInput!) {
  registerMerchant(input: $input) { businessId storeId verificationEmailSent signInTicket }
}`;
const DASHBOARD_ORIGIN = 'https://dash.example.test';

/** One browser's trip to the provider and back as far as the consent screen. */
export interface StartedFlow {
  readonly provider: string;
  readonly status: number;
  readonly cookie: string;
  readonly setCookie: string;
  readonly authorizeUrl: URL;
  readonly state: string;
  readonly ip: string;
}

/** Where the callback sent the browser. */
export interface CallbackOutcome {
  readonly status: number;
  readonly location: URL;
  readonly page: string;
  readonly ticket: string | null;
  readonly error: string | null;
}

export const googleProfile = (email: string, verified = true, subject: string = randomUUID()): ProviderProfile => ({
  sub: subject,
  email,
  email_verified: verified,
  given_name: 'Sara',
  family_name: 'Owner',
});

export const facebookProfile = (email: string | undefined, subject: string = randomUUID()): ProviderProfile => ({
  id: subject,
  ...(email === undefined ? {} : { email }),
  first_name: 'Sara',
  last_name: 'Owner',
});

/** Plugin options whose URLs are read late: the mock's port is only known once it listens. */
function pluginOptions(mock: MockOAuthServer): AuthOAuthOptions {
  const endpoints = (provider: string): AuthOAuthOptions['providers']['google'] => ({
    clientId: `synthetic-${provider}-client`,
    clientSecret: MOCK_CLIENT_SECRET,
    get authorizeUrl() {
      return `${mock.baseUrl}/${provider}/authorize`;
    },
    get tokenUrl() {
      return `${mock.baseUrl}/${provider}/token`;
    },
    get userInfoUrl() {
      return `${mock.baseUrl}/${provider}/userinfo`;
    },
  });
  return { providers: { google: endpoints('google'), facebook: endpoints('facebook') }, secureCookie: false };
}

/** The registration kit, a mock provider, and the browser's side of the redirect flow. */
export interface OAuthTestKit extends RegisterTestKit {
  readonly mock: MockOAuthServer;
  readonly startFlow: (provider: string, query?: string) => Promise<StartedFlow>;
  readonly callback: (
    provider: string,
    params: Readonly<Record<string, string>>,
    caller: Caller,
  ) => Promise<CallbackOutcome>;
  readonly signInThrough: (provider: string, profile: ProviderProfile) => Promise<OAuthRun>;
  readonly authenticate: (ticket: string, caller: Caller) => Promise<GraphqlAnswer>;
  readonly registerWithTicket: (input: Record<string, unknown>, caller: Caller) => Promise<GraphqlAnswer>;
  readonly methodsOfSubject: (provider: string, subject: string) => Promise<ExternalAuthenticationMethod[]>;
  readonly stop: () => Promise<void>;
}

/** A completed callback and the browser that made it. */
export interface OAuthRun extends CallbackOutcome {
  readonly browser: Caller;
}

/** Builds the {@link OAuthTestKit} of a test file; `start` must run before it is used. */
export function createOAuthTestKit(): OAuthTestKit {
  const mock = new MockOAuthServer();
  const kit = createRegisterTestKit({ oauth: pluginOptions(mock) });
  const { client, server } = kit;

  async function startFlow(provider: string, query = ''): Promise<StartedFlow> {
    const ip = uniqueIp();
    const response = await fetch(client.url(`/auth/oauth/${provider}/start${query}`), {
      redirect: 'manual',
      headers: { 'x-test-client-ip': ip },
    });
    const setCookie = response.headers.getSetCookie().join('\n');
    const authorizeUrl = new URL(response.headers.get('location') ?? mock.baseUrl);
    return {
      provider,
      status: response.status,
      setCookie,
      cookie: setCookie.split(';')[0] ?? '',
      authorizeUrl,
      state: authorizeUrl.searchParams.get('state') ?? '',
      ip,
    };
  }

  async function callback(
    provider: string,
    params: Readonly<Record<string, string>>,
    caller: Caller,
  ): Promise<CallbackOutcome> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(client.url(`/auth/oauth/${provider}/callback?${query}`), {
      redirect: 'manual',
      headers: {
        ...(caller.cookie === undefined ? {} : { cookie: caller.cookie }),
        ...(caller.ip === undefined ? {} : { 'x-test-client-ip': caller.ip }),
      },
    });
    const location = new URL(response.headers.get('location') ?? DASHBOARD_ORIGIN, DASHBOARD_ORIGIN);
    return {
      status: response.status,
      location,
      page: location.pathname,
      ticket: location.searchParams.get('ticket'),
      error: location.searchParams.get('error'),
    };
  }

  async function signInThrough(provider: string, profile: ProviderProfile): Promise<OAuthRun> {
    const flow = await startFlow(provider);
    const browser: Caller = { cookie: flow.cookie, ip: flow.ip };
    const code = mock.approve(provider, flow.authorizeUrl, profile);
    return { ...(await callback(provider, { state: flow.state, code }, browser)), browser };
  }

  const authenticate = (ticket: string, caller: Caller): Promise<GraphqlAnswer> =>
    client.graphql(AUTHENTICATE, { ticket }, caller);

  const registerWithTicket = (input: Record<string, unknown>, caller: Caller): Promise<GraphqlAnswer> =>
    client.graphql(REGISTER_WITH_TICKET, { input }, caller);

  const methodsOfSubject = (provider: string, subject: string): Promise<ExternalAuthenticationMethod[]> =>
    server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(ExternalAuthenticationMethod)
      .find({ where: { strategy: provider, externalIdentifier: subject } });

  return {
    ...kit,
    mock,
    startFlow,
    callback,
    signInThrough,
    authenticate,
    registerWithTicket,
    methodsOfSubject,
    start: async () => {
      await mock.start();
      await kit.start();
    },
    stop: async () => {
      await server.destroy();
      await mock.stop();
    },
  };
}
