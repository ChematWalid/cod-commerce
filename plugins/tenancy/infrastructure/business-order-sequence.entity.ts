import { Column, Entity, PrimaryColumn } from 'typeorm';

/** The last order number a business issued. */
@Entity('business_order_sequence')
export class BusinessOrderSequenceEntity {
  @PrimaryColumn({ type: 'bigint' })
  businessId!: string;

  @Column({ type: 'bigint', default: 0 })
  last!: string;
}
