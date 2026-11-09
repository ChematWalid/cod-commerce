import { toBusinessId } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { RbacConvergeService, type RbacConvergePorts } from '../../application/rbac-converge.service';
import { CONVERGE_PAGE_SIZE } from '../../domain/constants';
import { RbacConvergeFailedError } from '../../domain/errors';
import type { ConvergeTarget } from '../../domain/ports/business-directory.port';
import { asOperationContext } from '../../domain/ports/operation-context';

const ctx = asOperationContext({});

const target = (index: number): ConvergeTarget => ({
  id: toBusinessId(String(1000 + index)),
  ownerRoleId: index,
  ownerAdministratorId: index,
});

function serviceOver(all: readonly ConvergeTarget[]) {
  const page = vi.fn((_ctx: unknown, afterId: string | undefined, limit: number) => {
    const start = afterId === undefined ? 0 : all.findIndex(({ id }) => id === afterId) + 1;
    return Promise.resolve(all.slice(start, start + limit));
  });
  const service = new RbacConvergeService({ directory: { page } } as unknown as RbacConvergePorts);
  return { service, page };
}

describe('RbacConvergeService.convergeAll', () => {
  it('visits every business across pages, counting those that changed', async () => {
    const all = Array.from({ length: CONVERGE_PAGE_SIZE + 1 }, (_unused, index) => target(index));
    const { service, page } = serviceOver(all);
    const visit = vi
      .spyOn(service, 'convergeBusiness')
      .mockImplementation((_ctx, { id }) => Promise.resolve(id === all[0]?.id));

    const report = await service.convergeAll(ctx);

    expect(report).toEqual({ businesses: all.length, changed: 1 });
    expect(page).toHaveBeenCalledTimes(2);
    expect(visit).toHaveBeenCalledTimes(all.length);
  });

  it('carries on past a failing business and reports every failure at the end', async () => {
    const all = [target(1), target(2), target(3)];
    const { service } = serviceOver(all);
    vi.spyOn(service, 'convergeBusiness').mockImplementation((_ctx, { id }) =>
      id === all[0]?.id ? Promise.reject(new Error('boom')) : Promise.resolve(true),
    );

    const failure = await service.convergeAll(ctx).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RbacConvergeFailedError);
    expect(failure).toMatchObject({
      businesses: 3,
      changed: 2,
      failures: [{ businessId: all[0]?.id, reason: 'boom' }],
    });
  });

  it('states how many failures its message leaves out', () => {
    const failures = Array.from({ length: 25 }, (_unused, index) => ({ businessId: target(index).id, reason: 'boom' }));

    expect(new RbacConvergeFailedError(25, 0, failures).message).toContain('and 5 more');
  });
});
