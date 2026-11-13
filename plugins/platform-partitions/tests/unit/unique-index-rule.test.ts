import { Column, DataSource, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { findUniqueIndexesWithoutPartitionKey } from '../../domain/unique-index-rule';

@Entity({ name: 'probe_bad', synchronize: false })
@Index('uq_probe_bad_dedupe', ['dedupeKey'], { unique: true })
class ProbeBad {
  @PrimaryColumn({ type: 'bigint' }) id!: string;
  @PrimaryColumn({ type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'varchar' }) dedupeKey!: string;
}

@Entity({ name: 'probe_good', synchronize: false })
@Index('uq_probe_good_dedupe', ['createdAt', 'dedupeKey'], { unique: true })
class ProbeGood {
  @PrimaryColumn({ type: 'bigint' }) id!: string;
  @PrimaryColumn({ type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'varchar' }) dedupeKey!: string;
}

@Entity({ name: 'probe_pk_only', synchronize: false })
class ProbePkOnly {
  @PrimaryColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ name: 'probe_unique_constraint', synchronize: false })
@Unique('uc_probe_ref', ['reference'])
class ProbeUniqueConstraint {
  @PrimaryColumn({ type: 'bigint' }) id!: string;
  @PrimaryColumn({ type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'varchar' }) reference!: string;
}

@Entity({ name: 'plain_table' })
@Index('uq_plain_name', ['name'], { unique: true })
class PlainTable {
  @PrimaryColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'varchar' }) name!: string;
}

type EntityClass = new () => object;

async function metadataOf(...entities: EntityClass[]) {
  const dataSource = new DataSource({ type: 'postgres', entities });
  await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  return dataSource.entityMetadatas;
}

const PARTITIONED = new Map([
  ['probe_bad', 'createdAt'],
  ['probe_good', 'createdAt'],
  ['probe_pk_only', 'createdAt'],
  ['probe_unique_constraint', 'createdAt'],
]);

describe('findUniqueIndexesWithoutPartitionKey', () => {
  it('reports a unique index that leaves out the partition column', async () => {
    // Arrange
    const entities = await metadataOf(ProbeBad);

    // Act
    const violations = findUniqueIndexesWithoutPartitionKey(entities, PARTITIONED);

    // Assert
    expect(violations).toEqual(['probe_bad: uq_probe_bad_dedupe']);
  });

  it('accepts a unique index that includes the partition column and a composite primary key', async () => {
    // Arrange
    const entities = await metadataOf(ProbeGood);

    // Act / Assert
    expect(findUniqueIndexesWithoutPartitionKey(entities, PARTITIONED)).toEqual([]);
  });

  it('counts the primary key as a unique index', async () => {
    // Arrange
    const entities = await metadataOf(ProbePkOnly);

    // Act
    const violations = findUniqueIndexesWithoutPartitionKey(entities, PARTITIONED);

    // Assert
    expect(violations).toEqual(['probe_pk_only: primary key']);
  });

  it('reports a unique constraint as well', async () => {
    // Arrange
    const entities = await metadataOf(ProbeUniqueConstraint);

    // Act
    const violations = findUniqueIndexesWithoutPartitionKey(entities, PARTITIONED);

    // Assert
    expect(violations).toEqual(['probe_unique_constraint: uc_probe_ref']);
  });

  it('ignores a table that is not partitioned', async () => {
    // Arrange
    const entities = await metadataOf(PlainTable);

    // Act / Assert
    expect(findUniqueIndexesWithoutPartitionKey(entities, PARTITIONED)).toEqual([]);
  });
});
