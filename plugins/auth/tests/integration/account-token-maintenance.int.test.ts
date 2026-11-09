import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { ConfigService, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { purgeFinishedAccountTokens } from '../../infrastructure/account-token-purge.task';
import { AccountTokenEntity } from '../../infrastructure/account-token.entity';
import { createAuthTestEnvironment } from './auth-test-environment';

const USER = 41;
const DAY_MS = 86_400_000;

const { server, adminClient } = createAuthTestEnvironment('integration-test-only-secret-0000000000');

const rows = () => server.app.get(TransactionalConnection).rawConnection.getRepository(AccountTokenEntity);

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
});

afterAll(async () => {
  await server.destroy();
});

beforeEach(async () => {
  await rows().clear();
});

describe('purge', () => {
  const NOW = new Date('2026-11-09T12:00:00.000Z');
  const ago = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS);
  const insert = (id: string, expiresAt: Date, consumedAt: Date | null) =>
    rows().insert({
      id,
      userId: USER,
      purpose: 'password-reset',
      tokenHash: id.padStart(64, '0'),
      expiresAt,
      consumedAt,
      createdAt: ago(30),
    });

  it('removes only rows seven days past expiry or consumption', async () => {
    // Arrange
    await insert('1', ago(8), null);
    await insert('2', ago(6), null);
    await insert('3', ago(-1), ago(8));
    await insert('4', ago(-1), ago(6));
    await insert('5', ago(-1), null);

    // Act
    const removed = await purgeFinishedAccountTokens(server.app.get(TransactionalConnection), NOW);

    // Assert
    const left = (await rows().find()).map((row) => row.id).sort();
    expect(removed).toBe(2);
    expect(left).toEqual(['2', '4', '5']);
  });

  it('is registered as a daily scheduled task', () => {
    // Act
    const taskIds = server.app.get(ConfigService).schedulerOptions.tasks.map((task) => task.id);

    // Assert
    expect(taskIds).toContain('account-token-purge');
  });
});

describe('Administrator custom fields', () => {
  it('keeps the internal fields out of the Admin API', async () => {
    // Act
    const result = await adminClient.query<{
      __type: { fields: { name: string }[] } | null;
    }>(gql`
      query {
        __type(name: "Administrator") {
          fields {
            name
          }
        }
      }
    `);
    const customFields = await adminClient.query<{
      __type: { fields: { name: string }[] | null } | null;
    }>(gql`
      query {
        __type(name: "AdministratorCustomFields") {
          fields {
            name
          }
        }
      }
    `);

    // Assert
    const names = [
      ...(result.__type?.fields.map((field) => field.name) ?? []),
      ...(customFields.__type?.fields?.map((field) => field.name) ?? []),
    ];
    expect(names).toContain('emailAddress');
    for (const hidden of ['businessId', 'phone', 'emailVerifiedAt', 'emailLocale']) {
      expect(names).not.toContain(hidden);
    }
  });
});
