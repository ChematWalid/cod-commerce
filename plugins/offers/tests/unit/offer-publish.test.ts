import { DomainError, FEATURE_KEYS, type FeatureKey, registerFeatureGate, type TenantScope } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidOfferTransitionError, OfferPublishInvalidError } from '../../domain/errors';
import { BUY_TARGET_OPTIONAL, BUY_TARGET_REQUIRED } from '../../domain/kinds/target-rules';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { publishProblems } from '../../domain/publish-check';
import { at } from '../support/builders';
import { ORDER_DISCOUNT_INPUT, QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { anOfferRecord, scopeA } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

/** The plan refusal a gate answers with while `gate.refuse` is set. */
class FeatureRefusedError extends DomainError {
  readonly code = 'test.feature-refused';
  constructor() {
    super('Not on this plan');
  }
}

/**
 * The feature gate of this file (D2533): Vitest gives each test file its own modules, so registering it here never
 * reaches another file, and the global gate needs no reset.
 */
const gate = { refuse: false, checks: [] as { feature: FeatureKey; scope: TenantScope }[] };
registerFeatureGate({
  assertEnabled: (feature, scope) => {
    gate.checks.push({ feature, scope });
    return gate.refuse ? Promise.reject(new FeatureRefusedError()) : Promise.resolve();
  },
});

describe('publishProblems (D2510)', () => {
  it('lists every publish problem at once', () => {
    // Arrange
    const offer = anOfferRecord({ title: '   ', targets: [], endsAt: at(-1) });

    // Act
    const problems = publishProblems(offer, BUY_TARGET_REQUIRED, at(0));

    // Assert
    expect(problems).toEqual(['title', 'targets', 'dates']);
  });

  it('finds nothing to refuse on a complete offer', () => {
    // Arrange
    const offer = anOfferRecord({ startsAt: at(1), endsAt: at(10) });

    // Act
    const problems = publishProblems(offer, BUY_TARGET_REQUIRED, at(0));

    // Assert
    expect(problems).toEqual([]);
  });

  it('needs no target when the kind requires none', () => {
    // Arrange
    const offer = anOfferRecord({ targets: [] });

    // Act
    const problems = publishProblems(offer, BUY_TARGET_OPTIONAL, at(0));

    // Assert
    expect(problems).toEqual([]);
  });

  it('refuses an end date in the past', () => {
    // Arrange
    const [past, now] = [anOfferRecord({ endsAt: at(-1) }), anOfferRecord({ endsAt: at(0) })];

    // Act
    const problems = [past, now].map((offer) => publishProblems(offer, BUY_TARGET_REQUIRED, at(0)));

    // Assert
    expect(problems).toEqual([['dates'], ['dates']]);
  });

  it('refuses a start after the end', () => {
    // Arrange
    const [after, same] = [
      anOfferRecord({ startsAt: at(6), endsAt: at(5) }),
      anOfferRecord({ startsAt: at(5), endsAt: at(5) }),
    ];

    // Act
    const problems = [after, same].map((offer) => publishProblems(offer, BUY_TARGET_REQUIRED, at(1)));

    // Assert
    expect(problems).toEqual([['dates'], ['dates']]);
  });
});

describe('OfferLifecycleService.publish (D2510)', () => {
  it('lists every publish problem at once and keeps the draft', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, {
      ...QUANTITY_INPUT,
      targets: [],
      endsAt: at(-1).toISOString(),
    });

    // Act
    const refusal = await rejectionOf(lifecycle.publish(ctx, scopeA, draft.id));

    // Assert
    expect(refusal).toBeInstanceOf(OfferPublishInvalidError);
    expect(refusal).toMatchObject({ code: 'offers.publish-invalid', problems: ['targets', 'dates'] });
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({
      status: 'draft',
      publishedAt: null,
      version: 1,
    });
  });

  it('publishes a kind that needs no target', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, ORDER_DISCOUNT_INPUT);

    // Act
    const published = await lifecycle.publish(ctx, scopeA, draft.id);

    // Assert
    expect(published).toMatchObject({ status: 'active', targets: [], version: 2 });
  });

  it('stamps publishedAt once', async () => {
    // Arrange
    const { service, lifecycle, setNow } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    setNow(at(5));

    // Act
    const published = await lifecycle.publish(ctx, scopeA, draft.id);
    setNow(at(6));
    const paused = await lifecycle.pause(ctx, scopeA, draft.id);
    setNow(at(7));
    const resumed = await lifecycle.resume(ctx, scopeA, draft.id);
    const again = await rejectionOf(lifecycle.publish(ctx, scopeA, draft.id));

    // Assert
    expect(published).toMatchObject({ status: 'active', publishedAt: at(5), version: 2, updatedAt: at(5) });
    expect(paused).toMatchObject({ status: 'paused', pausedAt: at(6), publishedAt: at(5) });
    expect(resumed).toMatchObject({ status: 'active', pausedAt: null, publishedAt: at(5), version: 4 });
    expect(again).toBeInstanceOf(InvalidOfferTransitionError);
  });

  it('publishes through the admin service too', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const published = await service.publish(ctx, scopeA, draft.id);

    // Assert
    expect(published.status).toBe('active');
  });

  it('calls requireFeature for active offers before publishing', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const [first, second] = [
      await service.createDraft(ctx, scopeA, QUANTITY_INPUT),
      await service.createDraft(ctx, scopeA, QUANTITY_INPUT),
    ];
    gate.checks.length = 0;

    // Act
    await lifecycle.publish(ctx, scopeA, first.id);
    await lifecycle.pause(ctx, scopeA, first.id);
    await lifecycle.resume(ctx, scopeA, first.id);
    gate.refuse = true;
    const refused = await rejectionOf(lifecycle.publish(ctx, scopeA, second.id)).finally(() => {
      gate.refuse = false;
    });

    // Assert
    expect(gate.checks).toEqual([
      { feature: FEATURE_KEYS.ActiveOffers, scope: scopeA },
      { feature: FEATURE_KEYS.ActiveOffers, scope: scopeA },
      { feature: FEATURE_KEYS.ActiveOffers, scope: scopeA },
    ]);
    expect(refused).toBeInstanceOf(FeatureRefusedError);
    await expect(service.get(ctx, scopeA, second.id)).resolves.toMatchObject({ status: 'draft', version: 1 });
  });
});
