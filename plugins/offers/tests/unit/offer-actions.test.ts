import { tenantOf } from '@cod/plugin-tenancy';
import { OFFER_PAGE_MAX } from '@cod/shared';
import { RequestContext } from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfferActions } from '../../api/offer-actions';
import { OfferReadUseCases, OfferWriteUseCases } from '../../api/offer-use-cases';
import { newOfferPerformanceRegistry } from '../../application/default-sources';
import { OfferAppTypeService } from '../../application/offer-app-type.service';
import { OfferPreviewService } from '../../application/offer-preview.service';
import { OfferStatsService } from '../../application/offer-stats.service';
import { InvalidQuoteRequestError, OfferConflictError, OfferNotFoundError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { EVERY_CHANNEL, QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';

vi.mock('@cod/plugin-tenancy', async (original) => ({
  ...(await original<typeof import('@cod/plugin-tenancy')>()),
  tenantOf: vi.fn(),
}));

/** An offer id no store holds. */
const UNKNOWN_ID = '1399999999999999999';

/** The actions over in-memory offers of store A, the caller's active store. */
function setUpActions() {
  const admin = setUpOfferAdmin();
  const { service, lifecycle, codeBook } = admin;
  const clock = { now: () => new Date() };
  const writes = new OfferWriteUseCases(service, lifecycle, codeBook);
  const reads = new OfferReadUseCases(
    new OfferStatsService({ stores: EVERY_CHANNEL, performance: newOfferPerformanceRegistry() }),
    new OfferAppTypeService(),
    new OfferPreviewService({ stores: EVERY_CHANNEL, kinds: admin.kinds, clock }),
  );
  return { actions: new OfferActions(writes, reads), ...admin };
}

const ctx = RequestContext.empty();

beforeEach(() => {
  vi.mocked(tenantOf).mockReturnValue({
    businessId: scopeA.businessId,
    storeIds: [scopeA.storeId],
    activeStoreId: scopeA.storeId,
  });
});

describe('OfferActions (D2517-D2519)', () => {
  it('parses list options and refuses take 51', async () => {
    // Arrange
    const { actions } = setUpActions();
    await actions.create(ctx, QUANTITY_INPUT);
    await actions.create(ctx, QUANTITY_INPUT);

    // Act
    const refusal = await actions.list(ctx, { take: OFFER_PAGE_MAX + 1 }).catch((error: unknown) => error);
    const fromQueryString = await actions.list(ctx, { take: '1', skip: '0', status: '' });

    // Assert
    expect(refusal).toBeInstanceOf(InvalidQuoteRequestError);
    expect(fromQueryString.totalItems).toBe(2);
    expect(fromQueryString.items).toHaveLength(1);
    expect(fromQueryString.items[0]).toMatchObject({
      codeCount: 0,
      performance: { orders: 0, deliveredRevenue: 0, discountGiven: 0 },
    });
  });

  it('creates a draft in the active store and reads it back with its counts', async () => {
    // Arrange
    const { actions, service } = setUpActions();

    // Act
    const created = await actions.create(ctx, { ...QUANTITY_INPUT, method: 'codes' });
    await actions.addCodes(ctx, created.id, [{ code: 'save10' }]);
    const read = await actions.get(ctx, created.id);

    // Assert
    expect(created).toMatchObject({ status: 'draft', title: 'Buy two', codeCount: 0 });
    expect(read).toMatchObject({ id: created.id, codeCount: 1 });
    await expect(service.get(asOperationContext(ctx), scopeA, created.id)).resolves.toMatchObject({ id: created.id });
  });

  it('answers null for an unknown offer and not found for its stats and codes', async () => {
    // Arrange
    const { actions } = setUpActions();

    // Act
    const read = await actions.get(ctx, UNKNOWN_ID);
    const stats = await actions.stats(ctx, UNKNOWN_ID).catch((error: unknown) => error);
    const codes = await actions.codes(ctx, UNKNOWN_ID).catch((error: unknown) => error);

    // Assert
    expect(read).toBeNull();
    expect(stats).toBeInstanceOf(OfferNotFoundError);
    expect(codes).toBeInstanceOf(OfferNotFoundError);
  });

  it('refuses an update read at an older version with offer-conflict', async () => {
    // Arrange
    const { actions } = setUpActions();
    const created = await actions.create(ctx, QUANTITY_INPUT);
    await actions.update(ctx, created.id, { title: 'First edit' }, created.version);

    // Act
    const refusal = await actions
      .update(ctx, created.id, { title: 'Stale edit' }, created.version)
      .catch((error: unknown) => error);
    const current = await actions.get(ctx, created.id);

    // Assert
    expect(refusal).toBeInstanceOf(OfferConflictError);
    expect(current).toMatchObject({ title: 'First edit', version: created.version + 1 });
  });

  it('ignores patch keys that are not offer fields', async () => {
    // Arrange
    const { actions } = setUpActions();
    const created = await actions.create(ctx, QUANTITY_INPUT);

    // Act
    const updated = await actions.update(ctx, created.id, { title: 'Renamed', status: 'active', usageCount: 9 });

    // Assert
    expect(updated).toMatchObject({ title: 'Renamed', status: 'draft', usageCount: 0 });
  });

  it('publishes, pauses, duplicates and deletes the duplicate', async () => {
    // Arrange
    const { actions } = setUpActions();
    const created = await actions.create(ctx, QUANTITY_INPUT);

    // Act
    const published = await actions.publish(ctx, created.id);
    const paused = await actions.pause(ctx, created.id);
    const copy = await actions.duplicate(ctx, created.id);
    await actions.delete(ctx, copy.id);

    // Assert
    expect(published.publishedAt).not.toBeNull();
    expect(paused.status).toBe('paused');
    expect(copy).toMatchObject({ status: 'draft', publishedAt: null });
    await expect(actions.get(ctx, copy.id)).resolves.toBeNull();
  });

  it('lists the app types and previews a draft without storing it', async () => {
    // Arrange
    const { actions } = setUpActions();

    // Act
    const appTypes = await actions.appTypes(ctx);
    const preview = await actions.preview(ctx, { offer: QUANTITY_INPUT, samplePrice: null });
    const page = await actions.list(ctx, {});

    // Assert
    expect(appTypes.map((appType) => appType.id)).toContain('discount_codes');
    expect(preview.scenarios.length).toBeGreaterThan(0);
    expect(page.totalItems).toBe(0);
  });

  it('stores a target sent with a null role as a buy target on create, preview and update', async () => {
    // Arrange
    const { actions } = setUpActions();
    const nullRoleTargets = [{ role: null, refType: 'variant', refId: '11' }];

    // Act
    const created = await actions.create(ctx, { ...QUANTITY_INPUT, targets: nullRoleTargets });
    const updated = await actions.update(ctx, created.id, { targets: nullRoleTargets });
    const preview = await actions.preview(ctx, { offer: { ...QUANTITY_INPUT, targets: nullRoleTargets } });

    // Assert
    expect(created.targets).toEqual([{ role: 'buy', refType: 'variant', refId: '11' }]);
    expect(updated.targets).toEqual([{ role: 'buy', refType: 'variant', refId: '11' }]);
    expect(preview.scenarios.length).toBeGreaterThan(0);
  });

  it('keeps the stored value of a field that cannot be null when an update sends it null', async () => {
    // Arrange
    const { actions } = setUpActions();
    const created = await actions.create(ctx, { ...QUANTITY_INPUT, method: 'codes', label: { en: 'Two for less' } });
    const nulls = { kind: null, method: null, label: null, config: null, combinesWith: null, eligibility: null };

    // Act
    const updated = await actions.update(ctx, created.id, { ...nulls, title: 'Renamed', targets: null });

    // Assert
    expect(updated).toMatchObject({
      title: 'Renamed',
      kind: 'quantity',
      method: 'codes',
      label: { en: 'Two for less' },
      config: created.config,
      targets: created.targets,
    });
  });

  it('clears a clearable field an update sends as null', async () => {
    // Arrange
    const { actions } = setUpActions();
    const created = await actions.create(ctx, {
      ...QUANTITY_INPUT,
      totalUsageLimit: 5,
      endsAt: '2027-01-01T00:00:00Z',
    });

    // Act
    const updated = await actions.update(ctx, created.id, { totalUsageLimit: null, endsAt: null });

    // Assert
    expect(updated).toMatchObject({ totalUsageLimit: null, endsAt: null });
  });
});
