import type { Snowflake } from '@cod/shared';
import type { MemberAccount, MemberAccountPort, MemberAccountRequest } from '../../domain/ports/member-account.port';
import type { OperationContext } from '../../domain/ports/operation-context';

interface StoredAccount {
  readonly businessId: Snowflake;
  readonly emailAddress: string;
  deleted: boolean;
}

/** Member accounts in memory, numbered from 1, so a test knows every id in advance. */
export class InMemoryMemberAccounts implements MemberAccountPort {
  readonly accounts = new Map<number, StoredAccount>();

  create(_ctx: OperationContext, request: MemberAccountRequest): Promise<MemberAccount> {
    const administratorId = this.accounts.size + 1;
    this.accounts.set(administratorId, {
      businessId: request.businessId,
      emailAddress: request.emailAddress,
      deleted: false,
    });
    return Promise.resolve({ administratorId, userId: administratorId });
  }

  businessIdOf(_ctx: OperationContext, administratorId: number): Promise<Snowflake | null> {
    const account = this.accounts.get(administratorId);
    return Promise.resolve(account === undefined || account.deleted ? null : account.businessId);
  }

  softDelete(_ctx: OperationContext, administratorId: number): Promise<void> {
    const account = this.accounts.get(administratorId);
    if (account !== undefined) {
      account.deleted = true;
    }
    return Promise.resolve();
  }
}
