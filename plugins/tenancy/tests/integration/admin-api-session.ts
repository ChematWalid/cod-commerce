import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { Administrator, Asset, AssetType, Channel, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { OWNER_PASSWORD } from './tenant-fixtures';

const CREATE_ROLE = gql`
  mutation ($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
    }
  }
`;

const CREATE_ADMINISTRATOR = gql`
  mutation ($input: CreateAdministratorInput!) {
    createAdministrator(input: $input) {
      id
    }
  }
`;

/** The part of Vendure's test client these helpers drive. */
export interface AdminClient {
  setChannelToken(token: string | null): void;
  asSuperAdmin(): Promise<void>;
  asUserWithCredentials(username: string, password: string): Promise<unknown>;
  query<T>(query: typeof CREATE_ROLE, variables?: Record<string, unknown>): Promise<T>;
}

/** A member of a business, holding a role on one channel only. */
export interface MemberRequest {
  readonly code: string;
  readonly businessId: string;
  readonly channelId: number;
  readonly permissions: readonly string[];
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

const memberEmail = (code: string): string => `${code}@example.test`;

/** Creates the member as the superadmin; the tenant link is internal, so it is written straight to the row. */
export async function createMember(app: INestApplication, client: AdminClient, request: MemberRequest): Promise<void> {
  const { code, businessId, channelId, permissions } = request;
  client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  await client.asSuperAdmin();
  const { createRole } = await client.query<{ createRole: { id: string } }>(CREATE_ROLE, {
    input: { code, description: code, permissions, channelIds: [`T_${String(channelId)}`] },
  });
  const { createAdministrator } = await client.query<{ createAdministrator: { id: string } }>(CREATE_ADMINISTRATOR, {
    input: {
      emailAddress: memberEmail(code),
      firstName: code,
      lastName: 'Member',
      password: OWNER_PASSWORD,
      roleIds: [createRole.id],
    },
  });
  await app
    .get(TransactionalConnection)
    .rawConnection.getRepository(Administrator)
    .update(createAdministrator.id.replace('T_', ''), { customFields: { businessId } });
}

/** Logs in as a member made by {@link createMember}, acting on the channel `channelId`. */
export async function actAsMember(
  app: INestApplication,
  client: AdminClient,
  code: string,
  channelId: number,
): Promise<void> {
  client.setChannelToken(await channelTokenOf(app, channelId));
  await client.asUserWithCredentials(memberEmail(code), OWNER_PASSWORD);
}

/** Puts an image asset on the channel and returns its wire id. */
export async function seedAsset(app: INestApplication, channelId: number): Promise<string> {
  const { rawConnection } = app.get(TransactionalConnection);
  const channel = await rawConnection.getRepository(Channel).findOneByOrFail({ id: channelId });
  const name = `asset-${String(channelId)}-${String(Date.now())}`;
  const asset = await rawConnection.getRepository(Asset).save(
    new Asset({
      name,
      type: AssetType.IMAGE,
      mimeType: 'image/png',
      width: 1,
      height: 1,
      fileSize: 1,
      source: `source/${name}.png`,
      preview: `preview/${name}.png`,
      channels: [channel],
    }),
  );
  return `T_${String(asset.id)}`;
}
