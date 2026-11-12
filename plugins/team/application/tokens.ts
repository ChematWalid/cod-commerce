/** Injection token of the `MemberRepositoryPort` adapter. */
export const MEMBER_REPOSITORY: unique symbol = Symbol('TeamMemberRepository');

/** Injection token of the `InvitationRepositoryPort` adapter. */
export const INVITATION_REPOSITORY: unique symbol = Symbol('TeamInvitationRepository');

/** Injection token of the `CommissionConfigRepositoryPort` adapter. */
export const COMMISSION_CONFIG_REPOSITORY: unique symbol = Symbol('TeamCommissionConfigRepository');

/** Injection token of the `SalaryPaymentRepositoryPort` adapter. */
export const SALARY_PAYMENT_REPOSITORY: unique symbol = Symbol('TeamSalaryPaymentRepository');

/** Injection token of the `InvitationTokenPort` adapter. */
export const INVITATION_TOKEN: unique symbol = Symbol('TeamInvitationToken');

/** Injection token of the `TransactionPort` adapter. */
export const TRANSACTION: unique symbol = Symbol('TeamTransaction');

/** Injection token of the `IdGeneratorPort` adapter. */
export const ID_GENERATOR: unique symbol = Symbol('TeamIdGenerator');
