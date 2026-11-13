/** The width of one partition: a UTC day or a UTC month. */
export type PartitionInterval = 'day' | 'month';

/** One partition of a table: its name and the half-open UTC range `[start, end)` it holds. */
export interface PartitionRef {
  readonly table: string;
  readonly name: string;
  readonly start: Date;
  readonly end: Date;
}

/** What a policy may do to a partition about to be scrubbed: build the SQL that clears sensitive columns. */
export interface PartitionScrub {
  /** A partition is scrubbed once its upper bound is this many intervals before the current interval. */
  readonly afterIntervals: number;
  /**
   * The statement to run on one partition; `partitionTable` is the partition's name, a plain identifier the caller may
   * quote. It runs on every maintenance while the partition stays eligible, so it must be idempotent.
   */
  readonly sql: (partitionTable: string) => string;
}

/** How one partitioned table is maintained (D106, ADR 0016). */
export interface PartitionPolicy {
  readonly table: string;
  /** The range column, a `timestamptz` in the primary key. */
  readonly column: string;
  readonly interval: PartitionInterval;
  /** Intervals created ahead of the current one. */
  readonly premake: number;
  /** Intervals kept behind the current one; an older partition is dropped unless `keepIf` holds it. */
  readonly retain: number;
  /** Called before a drop; a reason keeps the partition (and is logged as an error), `null` lets it go. */
  readonly keepIf?: (partition: PartitionRef) => Promise<string | null>;
  readonly scrub?: PartitionScrub;
}

/** What one maintenance run did. */
export interface PartitionMaintenanceReport {
  readonly created: string[];
  readonly dropped: string[];
  readonly kept: { partition: string; reason: string }[];
  readonly scrubbed: string[];
}
