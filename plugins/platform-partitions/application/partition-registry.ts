import { PartitionRegistryClosedError, PartitionTableAlreadyRegisteredError } from '../domain/errors';
import type { PartitionPolicy } from '../domain/policy';
import { assertValidPolicy } from '../domain/policy-validation';

/**
 * The policies of every partitioned table. Each owning plugin registers its table in `onModuleInit`; the registry
 * closes at bootstrap, so every process maintains the same set.
 */
export class PartitionRegistry {
  private readonly registered = new Map<string, PartitionPolicy>();
  private closed = false;

  /**
   * @throws InvalidPartitionPolicyError for a policy the DDL would not survive.
   * @throws PartitionTableAlreadyRegisteredError when the table has a policy.
   * @throws PartitionRegistryClosedError after bootstrap.
   */
  register(policy: PartitionPolicy): void {
    if (this.closed) throw new PartitionRegistryClosedError(policy.table);
    assertValidPolicy(policy);
    if (this.registered.has(policy.table)) throw new PartitionTableAlreadyRegisteredError(policy.table);
    this.registered.set(policy.table, policy);
  }

  /** Every registered policy, in registration order. */
  policies(): readonly PartitionPolicy[] {
    return [...this.registered.values()];
  }

  /** Called once at bootstrap; later registrations throw. */
  close(): void {
    this.closed = true;
  }
}
