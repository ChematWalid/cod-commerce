import type { BuiltInRoleKey } from '@cod/shared';
import type { CredentialsFixture } from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { Administrator, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import type { ObjectLiteral, Repository, EntityTarget } from 'typeorm';
import { ActivityLogEntity } from '../../infrastructure/activity-log.entity';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { RoleBindingEntity } from '../../infrastructure/role-binding.entity';

export const SET_ACCESS = gql`
  mutation ($input: SetMemberAccessInput!) {
    setMemberAccess(input: $input) {
      administratorId
      roles {
        id
        name
      }
      storeAccess
      storeIds
    }
  }
`;

export const MEMBER_ACCESS = gql`
  query ($administratorId: String!) {
    memberAccess(administratorId: $administratorId) {
      administratorId
      roles {
        id
        name
      }
      storeAccess
      storeIds
    }
  }
`;

export const ARCHIVE_STORE = gql`
  mutation ($id: String!) {
    archiveStore(id: $id) {
      id
      status
    }
  }
`;

export interface AccessInput {
  readonly administratorId: string;
  readonly roleIds: readonly string[];
  readonly storeAccess: 'all' | 'selected';
  readonly storeIds?: readonly string[];
}

export interface AccessAnswer {
  readonly setMemberAccess: {
    readonly administratorId: string;
    readonly roles: readonly { readonly id: string; readonly name: string }[];
    readonly storeAccess: string;
    readonly storeIds: readonly string[];
  };
}

/** Database reads the tests assert on. */
export class AccessRows {
  constructor(private readonly app: INestApplication) {}

  private repository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.app.get(TransactionalConnection).rawConnection.getRepository<T>(entity);
  }

  async administratorId(member: CredentialsFixture): Promise<string> {
    const row = await this.repository(Administrator).findOneByOrFail({ emailAddress: member.email });
    return String(row.id);
  }

  async roleId(businessId: string, key: BuiltInRoleKey): Promise<string> {
    return (await this.repository(BusinessRoleEntity).findOneByOrFail({ businessId, builtInKey: key })).id;
  }

  bindings(businessRoleId: string): Promise<RoleBindingEntity[]> {
    return this.repository(RoleBindingEntity).findBy({ businessRoleId });
  }

  vendureRoleExists(id: number): Promise<boolean> {
    return this.repository<ObjectLiteral>('Role').existsBy({ id });
  }

  activity(businessId: string, entityId: string): Promise<ActivityLogEntity[]> {
    return this.repository(ActivityLogEntity).findBy({ businessId, entityId });
  }
}
