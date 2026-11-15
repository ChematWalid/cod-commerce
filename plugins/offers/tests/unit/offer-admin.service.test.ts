import { MAX_CODES_PER_ADD } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  CodeTakenError,
  InvalidOfferConfigError,
  InvalidOfferTransitionError,
  OfferNotFoundError,
  UnknownOfferKindError,
} from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { at, T0 } from '../support/builders';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA, scopeA2 } from '../support/offer-records';

const ctx = asOperationContext({});

describe('OfferAdminService', () => {
  it('creates a draft and validates config with the kind schema', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();

    // Act
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    const badConfig = service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, config: { priceMode: 'percent' } });

    // Assert
    expect(draft).toMatchObject({ status: 'draft', title: 'Buy two', version: 1, usageCount: 0, publishedAt: null });
    expect(draft.config).toEqual({
      priceMode: 'percent',
      tiers: [{ quantity: 2, price: 10, preselected: false, freeDelivery: false }],
    });
    expect(draft.targets).toEqual([{ role: 'buy', refType: 'variant', refId: '11' }]);
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toEqual(draft);
    await expect(badConfig).rejects.toBeInstanceOf(InvalidOfferConfigError);
  });

  it('refuses an unknown kind', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();

    // Act
    const created = service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, kind: 'mystery_box' });

    // Assert
    await expect(created).rejects.toBeInstanceOf(UnknownOfferKindError);
    await expect(service.list(ctx, scopeA)).resolves.toEqual([]);
  });

  it('refuses an input that breaks the offer schema', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();

    // Act
    const created = service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, title: '' });

    // Assert
    await expect(created).rejects.toBeInstanceOf(InvalidOfferConfigError);
  });

  it('publishes and records publishedAt', async () => {
    // Arrange
    const { service, setNow } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    setNow(at(5));

    // Act
    const published = await service.setStatus(ctx, scopeA, draft.id, 'active');
    setNow(at(6));
    const paused = await service.setStatus(ctx, scopeA, draft.id, 'paused');
    setNow(at(7));
    const resumed = await service.setStatus(ctx, scopeA, draft.id, 'active');

    // Assert
    expect(published).toMatchObject({ status: 'active', publishedAt: at(5), version: 2, updatedAt: at(5) });
    expect(paused).toMatchObject({ status: 'paused', pausedAt: at(6), publishedAt: at(5) });
    expect(resumed).toMatchObject({ status: 'active', pausedAt: null, publishedAt: at(5), version: 4 });
  });

  it('archives once and refuses any status change after', async () => {
    // Arrange
    const { service, setNow } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    setNow(at(9));

    // Act
    const archived = await service.setStatus(ctx, scopeA, draft.id, 'archived');
    const reopened = service.setStatus(ctx, scopeA, draft.id, 'active');

    // Assert
    expect(archived).toMatchObject({ status: 'archived', archivedAt: at(9) });
    await expect(reopened).rejects.toBeInstanceOf(InvalidOfferTransitionError);
    await expect(service.setStatus(ctx, scopeA, draft.id, 'archived')).rejects.toBeInstanceOf(
      InvalidOfferTransitionError,
    );
  });

  it('refuses to pause a draft', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const paused = service.setStatus(ctx, scopeA, draft.id, 'paused');

    // Assert
    await expect(paused).rejects.toBeInstanceOf(InvalidOfferTransitionError);
  });

  it('refuses to edit an archived offer', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    await service.setStatus(ctx, scopeA, draft.id, 'archived');

    // Act
    const edited = service.update(ctx, scopeA, draft.id, { title: 'Too late' });
    const coded = service.addCodes(ctx, scopeA, draft.id, [{ code: 'LATE10' }]);

    // Assert
    await expect(edited).rejects.toBeInstanceOf(InvalidOfferTransitionError);
    await expect(coded).rejects.toBeInstanceOf(InvalidOfferTransitionError);
  });

  it('refuses to remove a code of an archived offer', async () => {
    // Arrange
    const { service, tables } = setUpOfferAdmin();
    const offer = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    await service.addCodes(ctx, scopeA, offer.id, [{ code: 'INFLU10' }]);
    await service.setStatus(ctx, scopeA, offer.id, 'archived');

    // Act
    const removed = service.removeCode(ctx, scopeA, offer.id, 'INFLU10');

    // Assert
    await expect(removed).rejects.toBeInstanceOf(InvalidOfferTransitionError);
    await expect(tables.codes.listOf(ctx, scopeA, offer.id)).resolves.toHaveLength(1);
  });

  it('keeps the stored value of a patch key given as undefined', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, {
      ...QUANTITY_INPUT,
      method: 'codes',
      totalUsageLimit: 50,
      perBuyerLimit: 1,
      startsAt: '2026-12-01T00:00:00Z',
      endsAt: '2026-12-31T00:00:00Z',
      combinesWith: { order: true, delivery: true },
    });

    // Act
    const updated = await service.update(ctx, scopeA, draft.id, {
      title: 'Renamed',
      method: undefined,
      totalUsageLimit: undefined,
      perBuyerLimit: undefined,
      startsAt: undefined,
      endsAt: undefined,
      targets: undefined,
      combinesWith: undefined,
    });

    // Assert
    expect(updated).toEqual({ ...draft, title: 'Renamed', version: 2 });
  });

  it('bumps version on update', async () => {
    // Arrange
    const { service, setNow } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, startsAt: '2026-11-20T08:00:00Z' });
    setNow(at(3));

    // Act
    const updated = await service.update(ctx, scopeA, draft.id, { title: 'Buy three', perBuyerLimit: 2 });

    // Assert
    expect(updated).toMatchObject({ title: 'Buy three', perBuyerLimit: 2, version: 2, updatedAt: at(3) });
    expect(updated.startsAt).toEqual(new Date('2026-11-20T08:00:00Z'));
    expect(updated.createdAt).toEqual(T0);
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toEqual(updated);
  });

  it('answers an offer of another store or a malformed id as not found', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const fromOtherStore = service.get(ctx, scopeA2, draft.id);
    const malformed = service.get(ctx, scopeA, 'not-an-id');
    const deleted = service.delete(ctx, scopeA2, draft.id);

    // Assert
    await expect(fromOtherStore).rejects.toBeInstanceOf(OfferNotFoundError);
    await expect(malformed).rejects.toBeInstanceOf(OfferNotFoundError);
    await expect(deleted).rejects.toBeInstanceOf(OfferNotFoundError);
  });

  it('deletes an offer of the store', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    await service.delete(ctx, scopeA, draft.id);

    // Assert
    await expect(service.get(ctx, scopeA, draft.id)).rejects.toBeInstanceOf(OfferNotFoundError);
  });

  it('adds codes normalised and refuses a malformed or repeated one', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const offer = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });

    // Act
    const added = await service.addCodes(ctx, scopeA, offer.id, [{ code: ' influ10 ', usageLimit: 20 }]);
    const malformed = service.addCodes(ctx, scopeA, offer.id, [{ code: 'no spaces!' }]);
    const tooShort = service.addCodes(ctx, scopeA, offer.id, [{ code: 'ab' }]);
    const repeated = service.addCodes(ctx, scopeA, offer.id, [{ code: 'INFLU10' }]);

    // Assert
    expect(added).toMatchObject([{ code: 'INFLU10', offerId: offer.id, usageLimit: 20, usageCount: 0 }]);
    await expect(malformed).rejects.toBeInstanceOf(InvalidOfferConfigError);
    await expect(tooShort).rejects.toBeInstanceOf(InvalidOfferConfigError);
    await expect(repeated).rejects.toBeInstanceOf(CodeTakenError);
  });

  it('refuses more codes in one add than MAX_CODES_PER_ADD', async () => {
    // Arrange
    const { service, tables } = setUpOfferAdmin();
    const offer = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    const inputs = Array.from({ length: MAX_CODES_PER_ADD + 1 }, (_unused, index) => ({
      code: `BULK${String(index)}`,
    }));

    // Act
    const added = service.addCodes(ctx, scopeA, offer.id, inputs);

    // Assert
    await expect(added).rejects.toBeInstanceOf(InvalidOfferConfigError);
    await expect(tables.codes.listOf(ctx, scopeA, offer.id)).resolves.toEqual([]);
  });

  it('removes a code of the offer', async () => {
    // Arrange
    const { service, tables } = setUpOfferAdmin();
    const offer = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    await service.addCodes(ctx, scopeA, offer.id, [{ code: 'INFLU10' }]);

    // Act
    const removed = await service.removeCode(ctx, scopeA, offer.id, 'influ10');
    const again = await service.removeCode(ctx, scopeA, offer.id, 'influ10');

    // Assert
    expect([removed, again]).toEqual([true, false]);
    await expect(tables.codes.listOf(ctx, scopeA, offer.id)).resolves.toEqual([]);
  });
});
