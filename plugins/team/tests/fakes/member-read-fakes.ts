import type { Snowflake } from '@cod/shared';
import type { MemberGrant } from '../../domain/member-grant';
import type { MemberDirectoryPort } from '../../domain/ports/member-directory.port';

/** rbac's role names and holders' access and tenancy's store names, as a test arranges them. */
export class FakeMemberDirectory implements MemberDirectoryPort {
  readonly roles = new Map<Snowflake, string>();
  readonly held = new Map<number, MemberGrant>();
  readonly stores = new Map<Snowflake, string>();

  roleNames(): Promise<ReadonlyMap<Snowflake, string>> {
    return Promise.resolve(this.roles);
  }

  accessOfHolders(): Promise<ReadonlyMap<number, MemberGrant>> {
    return Promise.resolve(this.held);
  }

  storeNames(): Promise<ReadonlyMap<Snowflake, string>> {
    return Promise.resolve(this.stores);
  }
}
