import { toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { errorReportKey, exportFileKey, importSourceKey, isExportKey } from '../../domain/object-keys';

const scope = { businessId: toBusinessId('11'), storeId: toStoreId('22') };

describe('object keys (D2208)', () => {
  it('import key is uploads/b/<b>/s/<s>/imports/<id>/source', () => {
    // Act
    const key = importSourceKey(scope, '7301');

    // Assert
    expect(key).toBe('uploads/b/11/s/22/imports/7301/source');
    expect(isExportKey(key)).toBe(false);
  });

  it('export key is under exports/', () => {
    // Act
    const file = exportFileKey(scope, '7302');
    const report = errorReportKey(scope, '7301');

    // Assert
    expect(file).toBe('exports/b/11/s/22/exports/7302/file');
    expect(report).toBe('exports/b/11/s/22/imports/7301/errors');
    expect([file, report].every(isExportKey)).toBe(true);
  });

  it.each(['abc', '0', '-1', '7301/../9', '', '99999999999999999999'])('refuses a non-snowflake job id "%s"', (id) => {
    // Act and Assert
    expect(() => importSourceKey(scope, id)).toThrow();
    expect(() => exportFileKey(scope, id)).toThrow();
  });
});
