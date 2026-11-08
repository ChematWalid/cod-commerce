import { describe, expect, it } from 'vitest';
import { loadPluginTestDbConfig, MissingTestDatabaseUrlError } from '../src/plugin-test-db-config';

const DIRECT_URL = 'postgresql://cod:pw@localhost:5433/cod';

describe('loadPluginTestDbConfig', () => {
  it('reads DATABASE_URL_DIRECT', () => {
    // Arrange
    const env = { DATABASE_URL: 'postgresql://cod:pw@localhost:6432/cod', DATABASE_URL_DIRECT: DIRECT_URL };

    // Act
    const config = loadPluginTestDbConfig(env);

    // Assert
    expect(config).toEqual({ databaseUrl: DIRECT_URL });
  });

  it.each([{}, { DATABASE_URL_DIRECT: '' }])('fails clearly without DATABASE_URL_DIRECT: %o', (env) => {
    // Act
    const load = (): unknown => loadPluginTestDbConfig(env);

    // Assert
    expect(load).toThrow(MissingTestDatabaseUrlError);
    expect(load).toThrow(/DATABASE_URL_DIRECT/);
  });
});
