import type { Snowflake } from '@cod/shared';
import { BusinessNotFoundError, BusinessOwnerProtectedError, MemberNotInBusinessError } from '../domain/errors';
import type { MemberAccount, MemberAccountPort, MemberAccountRequest } from '../domain/ports/member-account.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PlatformStorePort } from '../domain/ports/platform-store.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** A request to create a team member's account in a business. */
export type CreateMemberAccountCommand = MemberAccountRequest;

/** The adapters {@link MemberAccountService} runs on. */
export interface MemberAccountPorts {
  readonly accounts: MemberAccountPort;
  readonly platform: PlatformStorePort;
  readonly transaction: TransactionPort;
}

/**
 * Creates and removes the commerce-engine accounts of team members (D202). Tenancy owns the account's business link
 * and the superadmin context account creation needs, so team reaches accounts only through this service.
 */
export class MemberAccountService {
  constructor(private readonly ports: MemberAccountPorts) {}

  /**
   * Creates an administrator of the business with no role; the caller grants access afterwards (D204).
   *
   * @throws {BusinessNotFoundError} when the business does not exist.
   * @throws {MemberEmailTakenError} when a live administrator already holds the address.
   */
  create(ctx: OperationContext, command: CreateMemberAccountCommand): Promise<MemberAccount> {
    return this.ports.transaction.run(ctx, async (transactional) => {
      const business = await this.ports.platform.findBusiness(transactional, command.businessId);
      if (business === undefined) throw new BusinessNotFoundError();
      return this.ports.accounts.create(transactional, command);
    });
  }

  /**
   * Soft-deletes a member's account, ending its sessions.
   *
   * @throws {MemberNotInBusinessError} when no live administrator of the business has this id.
   * @throws {BusinessOwnerProtectedError} when the administrator is the business owner.
   */
  softDelete(ctx: OperationContext, businessId: Snowflake, administratorId: number): Promise<void> {
    return this.ports.transaction.run(ctx, async (transactional) => {
      const memberOf = await this.ports.accounts.businessIdOf(transactional, administratorId);
      if (memberOf !== businessId) throw new MemberNotInBusinessError();
      const business = await this.ports.platform.findBusiness(transactional, businessId);
      if (business?.ownerAdministratorId === administratorId) throw new BusinessOwnerProtectedError();
      await this.ports.accounts.softDelete(transactional, administratorId);
    });
  }
}
