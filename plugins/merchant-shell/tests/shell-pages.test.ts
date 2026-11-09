import { describe, expect, it } from 'vitest';
import { createShellPageRegistry, getShellPage, registerShellPage } from '../dashboard/registry/shell-pages';
import type { ShellLeafId } from '../dashboard/model/tree';

const pageA = { component: () => null };
const pageB = { component: () => null };

describe('the shell page registry', () => {
  it('returns the page registered for a leaf', () => {
    const registry = createShellPageRegistry();

    registry.register('orders.all', pageA);

    expect(registry.get('orders.all')).toBe(pageA);
  });

  it('throws on a second registration of the same leaf and keeps the first page', () => {
    const registry = createShellPageRegistry();
    registry.register('orders.all', pageA);

    expect(() => {
      registry.register('orders.all', pageB);
    }).toThrow(/orders\.all/);
    expect(registry.get('orders.all')).toBe(pageA);
  });

  it('returns undefined for a leaf with no page', () => {
    expect(createShellPageRegistry().get('orders.spam')).toBeUndefined();
    expect(createShellPageRegistry().get('nope' as ShellLeafId)).toBeUndefined();
  });

  it('keeps registries apart', () => {
    const first = createShellPageRegistry();
    first.register('team.roles', pageA);

    expect(createShellPageRegistry().get('team.roles')).toBeUndefined();
  });

  it('exposes one shared registry through registerShellPage and getShellPage', () => {
    registerShellPage('tracking.returns', pageA);

    expect(getShellPage('tracking.returns')).toBe(pageA);
    expect(() => {
      registerShellPage('tracking.returns', pageB);
    }).toThrow(/tracking\.returns/);
  });
});
