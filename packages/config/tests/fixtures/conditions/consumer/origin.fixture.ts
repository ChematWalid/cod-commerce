import { expect, it } from 'vitest';
import { origin } from 'cond-fixture';

it('resolves the workspace package through the @cod/source condition', () => {
  expect(origin).toBe('source');
});
