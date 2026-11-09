import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type CredentialsFixture, type StoreFixture, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import type { SimpleGraphQLClient } from '@vendure/testing';

/** Signs in as `credentials` and makes `store` the channel of the following calls. */
export async function actAs(
  client: SimpleGraphQLClient,
  credentials: CredentialsFixture,
  store: StoreFixture,
): Promise<void> {
  client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  await client.asUserWithCredentials(credentials.email, credentials.password);
  client.setChannelToken(store.channelToken);
}

/** The status of a GET to `path` with the client's session and channel. */
export async function restStatus(app: INestApplication, client: SimpleGraphQLClient, path: string): Promise<number> {
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  const response = await client.fetch(`http://localhost:${String(port)}${path}`);
  return response.status;
}

/** Like {@link actAs}, but leaves the client's previous session open, so its token stays usable; returns the new token. */
export async function actAsInNewSession(
  client: SimpleGraphQLClient,
  credentials: CredentialsFixture,
  store: StoreFixture,
): Promise<string> {
  // `asUserWithCredentials` logs the current session out whenever the client holds a token.
  client.setAuthToken('');
  await actAs(client, credentials, store);
  return client.getAuthToken();
}

/** A REST call to make; a body goes as JSON. */
export interface RestRequest {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
}

/** What a REST call answered. */
export interface RestAnswer {
  readonly status: number;
  readonly body: unknown;
}

/** A REST call with the client's session and channel; a body goes as JSON. */
export async function restCall(
  app: INestApplication,
  client: SimpleGraphQLClient,
  { method, path, body }: RestRequest,
): Promise<RestAnswer> {
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  const response = await client.fetch(`http://localhost:${String(port)}${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown) };
}
