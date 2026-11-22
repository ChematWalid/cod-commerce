import { WILAYA_COUNT } from '@cod/shared';
import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeoSeedService } from '../../application/geo-seed.service';
import { GeoPlugin } from '../../geo.plugin';
import { loadGeoSeed } from '../../infrastructure/seed/load-geo-seed';

const SEED = loadGeoSeed();
const BOOT_TIMEOUT_MS = 120_000;

describe('geo seed on Postgres', () => {
  const { server } = createPluginTestEnvironment({
    plugins: [GeoPlugin],
    db: loadPluginTestDbConfig(process.env),
  });

  const sql = (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

  const counts = async (): Promise<{ provinces: number; towns: number }> => {
    const [row] = await sql(
      'SELECT (SELECT count(*) FROM geo_province)::int AS provinces, (SELECT count(*) FROM geo_town)::int AS towns',
    );
    return { provinces: Number(row?.['provinces']), towns: Number(row?.['towns']) };
  };

  const converge = () => server.app.get(GeoSeedService).converge();

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await server.destroy();
  });

  it('writes every wilaya and commune, and the same rows again on a second run', async () => {
    // Act
    const first = await converge();
    const afterFirst = await counts();
    await converge();
    const afterSecond = await counts();

    // Assert
    expect(first).toEqual({ provinces: WILAYA_COUNT, towns: SEED.towns.length });
    expect(afterFirst).toEqual({ provinces: WILAYA_COUNT, towns: SEED.towns.length });
    expect(afterSecond).toEqual(afterFirst);
  });

  it('restores the names and flags of a changed commune and keeps the jsonb names', async () => {
    // Arrange
    const town = SEED.towns.find((candidate) => candidate.codeOns === 1601);
    await converge();
    await sql(
      `UPDATE geo_town SET "name" = 'Changed', "names" = '["x"]', "isStopdesk" = NOT "isStopdesk" WHERE "codeOns" = $1`,
      [1601],
    );

    // Act
    await converge();
    const [row] = await sql(
      'SELECT "name", "names", "isStopdesk", "provinceCode" FROM geo_town WHERE "codeOns" = $1',
      [1601],
    );

    // Assert
    expect(row).toEqual({
      name: town?.name,
      names: town?.names,
      isStopdesk: town?.isStopdesk,
      provinceCode: town?.provinceCode,
    });
  });

  it('keeps a commune that left the seed: orders reference communes', async () => {
    // Arrange
    await converge();
    await sql(
      `INSERT INTO geo_town ("codeOns", "provinceCode", "name", "arabicName", "names", "isStopdesk", "isHomeDelivery")
       VALUES (99999, '16', 'Gone', 'Gone', '[]', false, true)`,
    );

    // Act
    await converge();
    const rows = await sql('SELECT 1 FROM geo_town WHERE "codeOns" = 99999');

    // Assert
    expect(rows).toHaveLength(1);
  });
});
