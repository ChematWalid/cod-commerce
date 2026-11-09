import { toBusinessId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ExtendAllBindingsService } from '../../application/extend-all-bindings.service';
import type { BusinessRole, RoleBinding } from '../../domain/business-role';
import { asOperationContext } from '../../domain/ports/operation-context';

const ctx = asOperationContext({});
const businessId = toBusinessId('7001');
const CHANNEL_ID = 9;

const binding = (businessRoleId: string, vendureRoleId: number): RoleBinding =>
  ({ id: `1${businessRoleId}`, businessRoleId, scope: 'all', vendureRoleId }) as RoleBinding;

function serviceWith(owner: Partial<BusinessRole> | undefined, bindings: readonly RoleBinding[]) {
  const calls: string[] = [];
  const service = new ExtendAllBindingsService({
    lock: {
      acquire: () => {
        calls.push('lock');
        return Promise.resolve();
      },
    },
    roles: { findBuiltIn: () => Promise.resolve(owner as BusinessRole | undefined) },
    bindings: {
      allStoresBindings: () => {
        calls.push('read');
        return Promise.resolve(bindings);
      },
    },
    engine: {
      addChannel: (_ctx, roleId, channelId) => {
        calls.push(`add ${String(roleId)} ${String(channelId)}`);
        return Promise.resolve();
      },
    },
  });
  return { service, calls };
}

describe('ExtendAllBindingsService', () => {
  it('locks before it reads, so a binding created concurrently cannot miss the store', async () => {
    const { service, calls } = serviceWith({ id: '5' } as Partial<BusinessRole>, []);

    await service.extendToStore(ctx, { businessId, channelId: CHANNEL_ID });

    expect(calls).toEqual(['lock', 'read']);
  });

  it("extends every all-stores binding except Owner's, which tenancy already extended", async () => {
    const { service, calls } = serviceWith({ id: '5' } as Partial<BusinessRole>, [binding('5', 50), binding('6', 60)]);

    await service.extendToStore(ctx, { businessId, channelId: CHANNEL_ID });

    expect(calls.slice(2)).toEqual([`add 60 ${String(CHANNEL_ID)}`]);
  });

  it('does nothing for the first store of a business, whose roles are not seeded yet', async () => {
    const { service, calls } = serviceWith(undefined, []);

    await service.extendToStore(ctx, { businessId, channelId: CHANNEL_ID });

    expect(calls).toEqual(['lock', 'read']);
  });
});
