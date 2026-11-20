import { describe, expect, it } from 'vitest';
import { OfferNotDeletableError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

describe('OfferAdminService.delete (D2521)', () => {
  it('refuses to delete a published offer', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const [active, paused, archived] = [
      await service.createDraft(ctx, scopeA, QUANTITY_INPUT),
      await service.createDraft(ctx, scopeA, QUANTITY_INPUT),
      await service.createDraft(ctx, scopeA, QUANTITY_INPUT),
    ];
    await lifecycle.publish(ctx, scopeA, active.id);
    await lifecycle.publish(ctx, scopeA, paused.id);
    await lifecycle.pause(ctx, scopeA, paused.id);
    await lifecycle.archive(ctx, scopeA, archived.id);

    // Act
    const refusals = [];
    for (const { id } of [active, paused, archived]) refusals.push(await rejectionOf(service.delete(ctx, scopeA, id)));

    // Assert
    for (const refusal of refusals) {
      expect(refusal).toBeInstanceOf(OfferNotDeletableError);
      expect(refusal).toMatchObject({ code: 'offers.offer-not-deletable' });
    }
    await expect(service.list(ctx, scopeA)).resolves.toMatchObject({ totalItems: 3 });
  });

  it('deletes a draft with its codes', async () => {
    // Arrange
    const { service, tables } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    await service.addCodes(ctx, scopeA, draft.id, [{ code: 'GONE10' }]);

    // Act
    await service.delete(ctx, scopeA, draft.id);

    // Assert
    expect(tables.offerRows).toEqual([]);
    expect(tables.codeRows).toEqual([]);
  });
});
