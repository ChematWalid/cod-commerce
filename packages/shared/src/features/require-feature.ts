import { DomainError } from '../errors/domain-error';
import type { TenantScope } from '../tenancy/tenant-scope';
import type { FeatureKey } from './feature-keys';

/** Decides whether a business may use a feature; rejects when it may not. */
export interface FeatureGate {
  assertEnabled(feature: FeatureKey, scope: TenantScope): Promise<void>;
}

/** Thrown when a second {@link FeatureGate} is registered: exactly one gate decides. */
export class FeatureGateAlreadyRegisteredError extends DomainError {
  readonly code = 'feature-gate.already-registered';

  constructor() {
    super('A feature gate is already registered');
  }
}

let registeredGate: FeatureGate | undefined;

/**
 * Installs the gate that {@link requireFeature} delegates to.
 *
 * @remarks Stub — owner: P9.S1 registers the real gate at boot.
 * @throws {@link FeatureGateAlreadyRegisteredError} on a second registration.
 */
export function registerFeatureGate(gate: FeatureGate): void {
  if (registeredGate !== undefined) {
    throw new FeatureGateAlreadyRegisteredError();
  }
  registeredGate = gate;
}

/**
 * Rejects when the business in `scope` may not use `feature`.
 *
 * No-op until P9.S1 registers the real gate; callers must still call it where the feature is gated.
 *
 * @remarks Stub — owner: P9.S1.
 */
export async function requireFeature(feature: FeatureKey, scope: TenantScope): Promise<void> {
  await registeredGate?.assertEnabled(feature, scope);
}
