import { Channel, TransactionalConnection } from '@vendure/core';
import type { INestApplication } from '@nestjs/common';
import { OWNER_PASSWORD } from './tenant-fixtures';

/** The part of Vendure's test client these helpers drive. */
export interface AdminClient {
  setChannelToken(token: string | null): void;
  asUserWithCredentials(username: string, password: string): Promise<unknown>;
}

/** The token of a channel, read straight from the database. */
export async function channelTokenOf(app: INestApplication, channelId: number): Promise<string> {
  const channels = app.get(TransactionalConnection).rawConnection.getRepository(Channel);
  const channel = await channels.findOneByOrFail({ id: channelId });
  return channel.token;
}

/** Logs in as `slug`'s owner, acting on the channel `channelId`. */
export async function actAsOwner(
  app: INestApplication,
  client: AdminClient,
  slug: string,
  channelId: number,
): Promise<void> {
  client.setChannelToken(await channelTokenOf(app, channelId));
  await client.asUserWithCredentials(`${slug}-owner@example.test`, OWNER_PASSWORD);
}
