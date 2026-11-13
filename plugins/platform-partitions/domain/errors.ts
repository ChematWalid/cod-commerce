import { DomainError } from '@cod/shared';

/** A policy that cannot be maintained safely: a name or a count the DDL would not survive. */
export class InvalidPartitionPolicyError extends DomainError {
  readonly code = 'platform-partitions.invalid-policy';

  constructor(table: string, reason: string) {
    super(`Partition policy for "${table}" is invalid: ${reason}`);
  }
}

/** A table has two policies; the first one wins nothing, so the second registration is a bug. */
export class PartitionTableAlreadyRegisteredError extends DomainError {
  readonly code = 'platform-partitions.table-already-registered';

  constructor(table: string) {
    super(`Table "${table}" already has a partition policy`);
  }
}

/** A policy was registered after bootstrap; register in `onModuleInit` so every process maintains the same tables. */
export class PartitionRegistryClosedError extends DomainError {
  readonly code = 'platform-partitions.registry-closed';

  constructor(table: string) {
    super(`Partition policy for "${table}" was registered after bootstrap; register it in onModuleInit`);
  }
}

/** One or more tables failed to maintain; the others were done. The scheduler's run fails, so no heartbeat is written. */
export class PartitionMaintenanceFailedError extends DomainError {
  readonly code = 'platform-partitions.maintenance-failed';

  constructor(readonly failures: readonly { table: string; reason: string }[]) {
    super(`Partition maintenance failed for ${failures.map((failure) => failure.table).join(', ')}`);
  }
}
