import { describe, expect, it } from 'vitest';
import { CodeMethodRequiredError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';

const ctx = asOperationContext({});

describe('OfferAdminService codes belong to code offers (D2449)', () => {
  it('refuses codes on an automatic offer', async () => {
    // Arrange
    const { service, tables } = setUpOfferAdmin();
    const automatic = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const adding = service.addCodes(ctx, scopeA, automatic.id, [{ code: 'INFLU10' }]);

    // Assert
    await expect(adding).rejects.toBeInstanceOf(CodeMethodRequiredError);
    expect(tables.codeRows).toEqual([]);
  });

  it('refuses to make a code offer automatic while it has codes', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const coded = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    await service.addCodes(ctx, scopeA, coded.id, [{ code: 'INFLU10' }]);

    // Act
    const editing = service.update(ctx, scopeA, coded.id, { method: 'automatic' });

    // Assert
    await expect(editing).rejects.toBeInstanceOf(CodeMethodRequiredError);
    await expect(service.get(ctx, scopeA, coded.id)).resolves.toMatchObject({ method: 'codes', version: 1 });
  });

  it('makes a code offer without codes automatic, and an automatic offer a code offer', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const coded = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    const automatic = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const madeAutomatic = await service.update(ctx, scopeA, coded.id, { method: 'automatic' });
    const madeCoded = await service.update(ctx, scopeA, automatic.id, { method: 'codes' });

    // Assert
    expect(madeAutomatic.method).toBe('automatic');
    expect(madeCoded.method).toBe('codes');
  });
});
