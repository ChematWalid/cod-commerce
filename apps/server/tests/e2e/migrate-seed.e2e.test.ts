import { preBootstrapConfig, resetConfig } from '@vendure/core';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppEnv, loadEnv, type ServerRole } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { runMigrate } from '../../src/roles/migrate.role';
import { COMMITTED_MIGRATION_COUNT } from './support/committed-migrations';
import { connectTo, createDatabase, dropDatabase } from './support/test-database';

const DATABASE_NAME = `cod_migrate_${String(process.pid)}`;

/** The seeded platform rows, read with plain SQL so the assertion does not depend on Vendure's services. */
interface SeedSnapshot {
  zones: string[];
  taxCategories: string[];
  taxRates: { name: string; value: string }[];
  defaultChannel: {
    defaultCurrencyCode: string;
    availableCurrencyCodes: string;
    pricesIncludeTax: boolean;
    taxZone: string | null;
    shippingZone: string | null;
  };
  availableLanguages: string;
}

const DEFAULT_CHANNEL_SQL = `
  SELECT c."defaultCurrencyCode", c."availableCurrencyCodes", c."pricesIncludeTax",
         tz.name AS "taxZone", sz.name AS "shippingZone"
    FROM channel c
    LEFT JOIN zone tz ON tz.id = c."defaultTaxZoneId"
    LEFT JOIN zone sz ON sz.id = c."defaultShippingZoneId"
   WHERE c.code = '__default_channel__'`;

function onlyRow<T>(rows: T[], what: string): T {
  const [row] = rows;
  if (rows.length !== 1 || row === undefined) {
    throw new Error(`Expected exactly one ${what} row, got ${String(rows.length)}`);
  }
  return row;
}

async function snapshot(url: string): Promise<SeedSnapshot> {
  const client = await connectTo(url);
  try {
    const names = async (table: string): Promise<string[]> =>
      (await client.query<{ name: string }>(`SELECT name FROM ${table} ORDER BY name`)).rows.map((row) => row.name);
    const taxRates = await client.query<{ name: string; value: string }>(
      'SELECT name, value FROM tax_rate ORDER BY name',
    );
    const channel = await client.query<SeedSnapshot['defaultChannel']>(DEFAULT_CHANNEL_SQL);
    const settings = await client.query<{ availableLanguages: string }>(
      'SELECT "availableLanguages" FROM global_settings',
    );
    return {
      zones: await names('zone'),
      taxCategories: await names('tax_category'),
      taxRates: taxRates.rows,
      defaultChannel: onlyRow(channel.rows, 'default channel'),
      availableLanguages: onlyRow(settings.rows, 'global settings').availableLanguages,
    };
  } finally {
    await client.end();
  }
}

/** The schema changes TypeORM would still make for `role`'s entities on the migrated database. */
async function pendingSchemaChanges(env: AppEnv, role: ServerRole): Promise<string[]> {
  const config = await preBootstrapConfig(buildVendureConfig(env, role));
  const dataSource = await new DataSource({ ...config.dbConnectionOptions, synchronize: false }).initialize();
  try {
    const log = await dataSource.driver.createSchemaBuilder().log();
    return log.upQueries.map((query) => query.query);
  } finally {
    await dataSource.destroy();
    resetConfig();
  }
}

describe('migrate role', () => {
  let env: AppEnv;
  let url: string;

  beforeAll(async () => {
    url = await createDatabase(DATABASE_NAME);
    // Both URLs point at the scratch database, straight to Postgres, whatever the shell's env says.
    env = loadEnv({ ...process.env, DATABASE_URL: url, DATABASE_URL_DIRECT: url });
  });

  afterAll(async () => {
    await dropDatabase(DATABASE_NAME);
  });

  it('migrates and seeds an empty database', async () => {
    const report = await runMigrate(env);

    expect(COMMITTED_MIGRATION_COUNT).toBeGreaterThan(0);
    expect(report.migrationsRun).toHaveLength(COMMITTED_MIGRATION_COUNT);
    expect(report.seed.changes).toEqual(
      expect.arrayContaining([
        'country:DZ',
        'zone:Algeria',
        'tax-category:Zero rate',
        'tax-rate:Algeria zero rate',
        'channel:__default_channel__',
        'global-settings:availableLanguages',
      ]),
    );
  });

  it('a second run is a no-op with identical rows', async () => {
    const before = await snapshot(url);

    const report = await runMigrate(env);

    expect(report).toEqual({ migrationsRun: [], seed: { changes: [] } });
    const after = await snapshot(url);
    expect(after).toEqual(before);
    expect(after).toEqual({
      zones: ['Algeria'],
      taxCategories: ['Zero rate'],
      taxRates: [{ name: 'Algeria zero rate', value: '0.00' }],
      defaultChannel: {
        defaultCurrencyCode: 'DZD',
        availableCurrencyCodes: 'DZD',
        pricesIncludeTax: true,
        taxZone: 'Algeria',
        shippingZone: 'Algeria',
      },
      availableLanguages: 'ar,fr,en',
    });
  });

  // RF4: a missing migration would make TypeORM want to change the schema of a fully migrated database.
  it('the committed migrations match the entities of every role', async () => {
    const pending = {
      migrate: await pendingSchemaChanges(env, 'migrate'),
      api: await pendingSchemaChanges(env, 'api'),
    };

    for (const [role, queries] of Object.entries(pending)) {
      if (queries.length > 0) {
        console.error(`Pending schema changes for the ${role} role:\n${queries.join('\n')}`);
      }
    }
    expect(pending).toEqual({ migrate: [], api: [] });
  });
});
