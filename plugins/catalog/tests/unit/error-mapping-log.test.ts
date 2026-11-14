import { RATE_LIMITED_CODE, RateLimitedError } from '@cod/plugin-rate-limit';
import { Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogErrorOf, withCatalogErrors } from '../../api/error-mapping';

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

  it('passes an over-limit refusal through with its code and wait (D2138)', async () => {
    // Arrange
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const refusal = new RateLimitedError(42);

    // Act
    const answering = withCatalogErrors(() => Promise.reject(refusal));

    // Assert
    await expect(answering).rejects.toMatchObject({ extensions: { code: RATE_LIMITED_CODE, retryAfterSeconds: 42 } });
    expect(logged).not.toHaveBeenCalled();
  });
});
