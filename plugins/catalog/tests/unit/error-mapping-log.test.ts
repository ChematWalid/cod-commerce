import { Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogErrorOf } from '../../api/error-mapping';

/** A merchant value a database message may quote. */
const QUOTED_VALUE = 'synthetic-merchant-sku-42';

describe('catalogErrorOf fault logging (D2136)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the fault type and stack frames but never its message', () => {
    // Arrange
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const fault = new TypeError(`duplicate key value (sku)=(${QUOTED_VALUE})`);

    // Act
    const mapped = catalogErrorOf(fault);

    // Assert
    expect(mapped).toBeUndefined();
    const text = JSON.stringify(logged.mock.calls);
    expect(text).toContain('TypeError');
    expect(text).toContain('error-mapping-log.test');
    expect(text).not.toContain(QUOTED_VALUE);
  });
});
