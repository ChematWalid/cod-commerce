/**
 * The DDL of one range-partitioned table (D106). The owning plugin keeps one constant per table; its migration copies
 * the SQL as a literal, and plugin tests apply it with `ensurePartitionedSchema` from `@cod/testing`.
 */
export interface PartitionedTableSchema {
  /** The parent table; its partitions are named `{table}_p{yyyymmdd}` or `{table}_p{yyyymm}`. */
  readonly table: string;
  /** The range column (the partition key), part of the primary key and of every unique index. */
  readonly column: string;
  /** The statements that create the parent table, its indexes and triggers; no partitions, no `DEFAULT` partition. */
  readonly createSql: string;
}
