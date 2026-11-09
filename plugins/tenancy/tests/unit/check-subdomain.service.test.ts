import { describe, expect, it } from 'vitest';
import { CheckSubdomainService } from '../../application/check-subdomain.service';
import type { StoreAdminPorts } from '../../application/store-admin-ports';
import { asOperationContext } from '../../domain/ports/operation-context';
import { InMemoryPlatformStore } from '../fakes/fakes';

const ctx = asOperationContext({});

function serviceWithTakenSubdomains(taken: readonly string[]): CheckSubdomainService {
  const platform = new InMemoryPlatformStore();
  platform.isSubdomainTaken = (_ctx, subdomain) => Promise.resolve(taken.includes(subdomain));
  return new CheckSubdomainService({ platform } as unknown as StoreAdminPorts);
}

describe('CheckSubdomainService', () => {
  it('reports a held subdomain as taken with the taken reason code', async () => {
    // Arrange
    const service = serviceWithTakenSubdomains(['atlas']);

    // Act
    const result = await service.check(ctx, ' ATLAS ');

    // Assert
    expect(result).toMatchObject({ subdomain: 'atlas', status: 'taken', reasonCode: 'taken' });
    expect(result.reason).not.toBeNull();
  });

  it('reports a free subdomain as available with no reason code', async () => {
    // Act
    const result = await serviceWithTakenSubdomains([]).check(ctx, 'free-name');

    // Assert
    expect(result).toEqual({ subdomain: 'free-name', status: 'available', reason: null, reasonCode: null });
  });

  it('does not look in the database for a reserved name', async () => {
    // Act
    const result = await serviceWithTakenSubdomains([]).check(ctx, 'www');

    // Assert
    expect(result).toMatchObject({ status: 'reserved', reasonCode: 'reserved' });
  });
});
