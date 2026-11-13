/** A column as TypeORM's `ColumnMetadata` describes it; only the database name matters here. */
interface ColumnLike {
  readonly databaseName: string;
}

/** An index or unique constraint as TypeORM's `IndexMetadata` and `UniqueMetadata` describe it. */
interface UniqueLike {
  readonly name?: string;
  readonly columns: readonly ColumnLike[];
}

/** An index as TypeORM's `IndexMetadata` describes it. */
interface IndexLike extends UniqueLike {
  readonly isUnique: boolean;
}

/**
 * The part of TypeORM's `EntityMetadata` this rule reads. It is declared here so the domain stays free of TypeORM; an
 * `EntityMetadata` is assignable to it.
 */
export interface EntityMetadataLike {
  readonly tableName: string;
  readonly primaryColumns: readonly ColumnLike[];
  readonly indices: readonly IndexLike[];
  readonly uniques: readonly UniqueLike[];
}

const PRIMARY_KEY_LABEL = 'primary key';

const includesColumn = (columns: readonly ColumnLike[], column: string): boolean =>
  columns.some((candidate) => candidate.databaseName === column);

/**
 * PostgreSQL enforces a unique index of a partitioned table only inside each partition unless it holds the partition
 * key, so such an index promises nothing across partitions. Returns `table: index` for every unique index, unique
 * constraint or primary key of a partitioned table that leaves the partition column out.
 * @param partitionColumns the partition column of each partitioned table, by table name.
 */
export function findUniqueIndexesWithoutPartitionKey(
  entities: readonly EntityMetadataLike[],
  partitionColumns: ReadonlyMap<string, string>,
): string[] {
  return entities.flatMap((entity) => {
    const column = partitionColumns.get(entity.tableName);
    if (column === undefined) return [];
    const unique: UniqueLike[] = [
      ...(entity.primaryColumns.length > 0 ? [{ name: PRIMARY_KEY_LABEL, columns: entity.primaryColumns }] : []),
      ...entity.indices.filter((index) => index.isUnique),
      ...entity.uniques,
    ];
    return unique
      .filter((index) => !includesColumn(index.columns, column))
      .map((index) => `${entity.tableName}: ${index.name ?? '(unnamed)'}`);
  });
}
