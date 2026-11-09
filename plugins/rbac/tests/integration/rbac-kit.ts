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
