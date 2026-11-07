import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureGate, FeatureKey, TenantScope } from '../src/index';

type SharedModule = typeof import('../src/index.js');

const loadShared = async (): Promise<SharedModule> => import('../src/index.js');

describe('requireFeature', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('resolves without a registered gate (no-op until P9.S1)', async () => {
    const shared = await loadShared();
    const scope: TenantScope = { businessId: shared.toBusinessId('1') };

    await expect(shared.requireFeature(shared.FEATURE_KEYS.Finance, scope)).resolves.toBeUndefined();
  });

  it('delegates to the registered gate', async () => {
    const shared = await loadShared();
    const scopeA: TenantScope = { businessId: shared.toBusinessId('1') };
    const calls: [FeatureKey, TenantScope][] = [];
    const gate: FeatureGate = {
      assertEnabled: (feature, scope) => {
        calls.push([feature, scope]);
        return Promise.resolve();
      },
    };
    shared.registerFeatureGate(gate);

    await shared.requireFeature(shared.FEATURE_KEYS.Finance, scopeA);

    expect(calls).toEqual([['finance', scopeA]]);
  });

  it('refuses a second registration', async () => {
    const shared = await loadShared();
    const gate: FeatureGate = { assertEnabled: () => Promise.resolve() };
    shared.registerFeatureGate(gate);

    expect(() => {
      shared.registerFeatureGate(gate);
    }).toThrow(shared.FeatureGateAlreadyRegisteredError);
  });
});
