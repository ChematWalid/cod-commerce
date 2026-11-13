import { FLAG_KEYS } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { Logger, type VendureLogger } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FlagSeedService } from '../../application/flag-seed.service';
import {
  clearFlagKeys,
  createFlagsTestEnvironment,
  REMOVE_OVERRIDE,
  SET_OVERRIDE,
  sqlOf,
  UPDATE_FEATURE_FLAG,
} from './flags-kit';

const SNOWFLAKE_WORKER_ID = 998;
const APP_ENV = 'test-platform-flags-audit';
const AI = FLAG_KEYS.ai;

/** Keeps every line logged at info level or above. */
class LineRecorder implements VendureLogger {
  readonly lines: string[] = [];
  error(message: string): void {
    this.lines.push(message);
  }
  warn(message: string): void {
    this.lines.push(message);
  }
  info(message: string): void {
    this.lines.push(message);
  }
  verbose(): void {
    // not recorded
  }
  debug(): void {
    // not recorded
  }
}

describe('flags audit trail (D116, D128)', () => {
  const { server, adminClient } = createFlagsTestEnvironment(SNOWFLAKE_WORKER_ID, APP_ENV);
  const sql = sqlOf(server);
  const recorder = new LineRecorder();
  let businesses: TwoBusinesses;
  let actor: string;

  const flagLines = (): string[] => recorder.lines.filter((line) => line.includes(`Feature flag ${AI} `));

  beforeAll(async () => {
    await clearFlagKeys(APP_ENV);
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    await server.app.get(FlagSeedService).converge();
    await adminClient.asSuperAdmin();
    const [user] = await sql(`SELECT "id" FROM "user" ORDER BY "id" LIMIT 1`);
    actor = `user:${String(user?.['id'])}`;
    await adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: AI, defaultEnabled: true, rolloutPercent: 100 } });
    Logger.useLogger(recorder);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
    await clearFlagKeys(APP_ENV);
  });

  it('logs the actor, the key, and the state before and after a default and rollout change', async () => {
    // Arrange
    recorder.lines.length = 0;

    // Act
    await adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: AI, defaultEnabled: false, rolloutPercent: 40 } });

    // Assert
    const [line, ...rest] = flagLines();
    expect(rest).toEqual([]);
    expect(line).toContain(`update by ${actor}`);
    expect(line).toContain('before {"defaultEnabled":true,"rolloutPercent":100');
    expect(line).toContain('after {"defaultEnabled":false,"rolloutPercent":40');
  });

  it('logs an override set and its removal with the override in the after and before state', async () => {
    // Arrange
    recorder.lines.length = 0;
    const target = { key: AI, scope: 'BUSINESS', scopeId: businesses.a.businessId };

    // Act
    await adminClient.query(SET_OVERRIDE, { input: { ...target, enabled: true } });
    await adminClient.query(REMOVE_OVERRIDE, { input: target });

    // Assert
    const [set, removed, ...rest] = flagLines();
    expect(rest).toEqual([]);
    const override = `"business:${businesses.a.businessId}=true"`;
    expect(set).toContain(`set override by ${actor}`);
    expect(set).toContain('"overrides":[]');
    expect(set).toContain(`"overrides":[${override}]`);
    expect(removed).toContain(`remove override by ${actor}`);
    expect(removed).toMatch(new RegExp(`before .*${override}.*after .*"overrides":\\[\\]`));
  });
});
