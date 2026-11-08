import { Column, Index } from 'typeorm';

/**
 * The base of every tenant-owned row (ADR 0002). Column types are explicit, so entities load without decorator
 * metadata; TypeORM reads `bigint` back as a decimal string.
 */
export abstract class TenantEntity {
  @Index()
  @Column({ type: 'bigint' })
  businessId!: string;

  @Column({ type: 'bigint', nullable: true })
  storeId!: string | null;
}
