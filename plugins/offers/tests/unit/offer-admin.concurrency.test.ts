import { describe, expect, it } from 'vitest';
import { OfferConflictError, OfferNotFoundError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';

const ctx = asOperationContext({});

/** A write read before a concurrent one must never undo it (optimistic lock on `version`, D2440). */
describe('OfferAdminService under concurrent writes', () => {
  it('refuses an edit read before a concurrent archive, and keeps the offer archived', async () => {
    // Arrange
    const { service, race } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    race(() => service.setStatus(ctx, scopeA, draft.id, 'archived'));

    // Act
    const edited = service.update(ctx, scopeA, draft.id, { title: 'Stale edit' });

    // Assert
    await expect(edited).rejects.toBeInstanceOf(OfferConflictError);
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ status: 'archived', version: 2 });
  });

  it('refuses a status change read before a concurrent archive', async () => {
    // Arrange
    const { service, race } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    await service.setStatus(ctx, scopeA, draft.id, 'active');
    race(() => service.setStatus(ctx, scopeA, draft.id, 'archived'));

    // Act
    const paused = service.setStatus(ctx, scopeA, draft.id, 'paused');

    // Assert
    await expect(paused).rejects.toBeInstanceOf(OfferConflictError);
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ status: 'archived', pausedAt: null });
  });

  it('answers not found when the offer is deleted between the read and the save', async () => {
    // Arrange
    const { service, race } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    race(() => service.delete(ctx, scopeA, draft.id));

    // Act
    const edited = service.update(ctx, scopeA, draft.id, { title: 'Gone' });

    // Assert
    await expect(edited).rejects.toBeInstanceOf(OfferNotFoundError);
  });
});
