import { TenantEntity } from '@cod/plugin-tenancy';
import { IDEMPOTENCY_KEY_MAX_LENGTH } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** The `salary_payment` row: at most one per member and client idempotency key (D212). */
@Entity('salary_payment')
@Index(['businessId', 'memberId', 'idempotencyKey'], { unique: true })
export class SalaryPaymentEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  memberId!: string;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: IDEMPOTENCY_KEY_MAX_LENGTH })
  idempotencyKey!: string;

  @Column({ type: 'int' })
  paidByAdministratorId!: number;

  @Column({ type: 'timestamptz' })
  paidAt!: Date;
}
