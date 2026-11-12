import type { PartitionRef } from './policy';

/** The work inside one table's transaction, under that table's lock. */
export interface PartitionTableSession {
  /** The existing range partitions of the table, in bound order; a `DEFAULT` partition is not listed. */
  list(): Promise<PartitionRef[]>;
  create(partition: PartitionRef, column: string): Promise<void>;
  /** Detaches and drops the partition together. */
  drop(partition: PartitionRef): Promise<void>;
  /** Runs a scrub statement a policy built. */
  execute(sql: string): Promise<void>;
}

/** The catalog and DDL of partitioned tables; the application orchestrates, an adapter talks to PostgreSQL (D106). */
export interface PartitionCatalog {
  /**
   * Runs `work` in one transaction that holds the table's lock, so two maintenances of a table never interleave; the
   * transaction commits when `work` returns and rolls back when it throws.
   */
  inTableTransaction<T>(table: string, work: (session: PartitionTableSession) => Promise<T>): Promise<T>;
}

/** Where maintenance reports what needs a person's attention (a kept partition, a table that failed). */
export interface PartitionLogger {
  error(message: string): void;
}
