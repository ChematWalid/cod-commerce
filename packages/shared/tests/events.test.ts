import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_NAMES } from '../src/index';

describe('domain event names', () => {
  const names = Object.values(DOMAIN_EVENT_NAMES);

  it('follows the aggregate.event-name format', () => {
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });

  it('never reuses a name', () => {
    expect(new Set(names).size).toBe(names.length);
  });
});
