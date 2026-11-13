import { describe, expect, it } from 'vitest';
import { ADMIN_API_REGISTRY, OPERATIONS_WITHOUT_FOREIGN_TARGET } from '../integration/endpoint-registry';

describe('two-business isolation registry', () => {
  it('names every operation without a foreign target, so none passes its positive control unchecked (TEN-10)', () => {
    // Act
    const uncontrolled = ADMIN_API_REGISTRY.filter((entry) => entry.control.kind === 'noForeignTarget');

    // Assert
    expect(uncontrolled.map((entry) => entry.operation)).toEqual(OPERATIONS_WITHOUT_FOREIGN_TARGET);
  });
});
