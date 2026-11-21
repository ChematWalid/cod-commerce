import { describe, expect, it } from 'vitest';
import { InvalidOfferConfigError, InvalidOfferTransitionError, OfferPublishInvalidError } from '../../domain/errors';
import { OFFER_MOVES, withMove } from '../../domain/offer-lifecycle';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { at } from '../support/builders';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { anOfferRecord, scopeA } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

/** A published quantity offer of store A that ends at `at(10)`, and the services over it. */
async function setUpPublished() {
  const setUp = setUpOfferAdmin();
  const draft = await setUp.service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, endsAt: at(10).toISOString() });
  const offer = await setUp.lifecycle.publish(ctx, scopeA, draft.id);
  return { ...setUp, offer };
}

describe('offer moves (D2510)', () => {
  it('moves only from the fixed sources of each move', () => {
    // Arrange
    const statuses = ['draft', 'active', 'paused', 'archived'] as const;

    // Act
    const allowed = Object.fromEntries(
      Object.keys(OFFER_MOVES).map((move) => [
        move,
        statuses.filter((status) => {
          try {
            withMove(anOfferRecord({ status }), move as keyof typeof OFFER_MOVES, at(1));
            return true;
          } catch {
            return false;
          }
        }),
      ]),
    );

    // Assert
    expect(allowed).toEqual({
      publish: ['draft'],
      pause: ['active'],
      resume: ['paused'],
      archive: ['draft', 'active', 'paused'],
    });
  });

  it('refuses to resume a draft', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const resumed = await rejectionOf(lifecycle.resume(ctx, scopeA, draft.id));

    // Assert
    expect(resumed).toBeInstanceOf(InvalidOfferTransitionError);
  });

  it('refuses to pause a draft', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const paused = await rejectionOf(lifecycle.pause(ctx, scopeA, draft.id));

    // Assert
    expect(paused).toBeInstanceOf(InvalidOfferTransitionError);
  });

  it('refuses setStatus active on a draft', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const activated = await rejectionOf(service.setStatus(ctx, scopeA, draft.id, 'active'));

    // Assert
    expect(activated).toBeInstanceOf(InvalidOfferTransitionError);
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ status: 'draft', publishedAt: null });
  });

  it('pauses and resumes through setStatus', async () => {
    // Arrange
    const { service, offer } = await setUpPublished();

    // Act
    const paused = await service.setStatus(ctx, scopeA, offer.id, 'paused');
    const resumed = await service.setStatus(ctx, scopeA, offer.id, 'active');

    // Assert
    expect([paused.status, resumed.status]).toEqual(['paused', 'active']);
  });

  it('re-checks a paused offer on resume and refuses an expired end date', async () => {
    // Arrange
    const { service, lifecycle, offer, setNow } = await setUpPublished();
    await lifecycle.pause(ctx, scopeA, offer.id);
    setNow(at(11));

    // Act
    const resumed = await rejectionOf(lifecycle.resume(ctx, scopeA, offer.id));

    // Assert
    expect(resumed).toBeInstanceOf(OfferPublishInvalidError);
    expect(resumed).toMatchObject({ problems: ['dates'] });
    await expect(service.get(ctx, scopeA, offer.id)).resolves.toMatchObject({ status: 'paused' });
  });

  it('refuses an update that blanks the title of an active offer', async () => {
    // Arrange
    const { service, offer } = await setUpPublished();

    // Act
    const blanked = await rejectionOf(service.update(ctx, scopeA, offer.id, { title: '   ' }));

    // Assert
    expect(blanked).toBeInstanceOf(InvalidOfferConfigError);
    await expect(service.get(ctx, scopeA, offer.id)).resolves.toEqual(offer);
  });

  it('refuses an update that drops the targets of an active or paused offer', async () => {
    // Arrange
    const { service, lifecycle, offer } = await setUpPublished();

    // Act
    const onActive = await rejectionOf(service.update(ctx, scopeA, offer.id, { targets: [] }));
    const paused = await lifecycle.pause(ctx, scopeA, offer.id);
    const onPaused = await rejectionOf(service.update(ctx, scopeA, offer.id, { targets: [] }));

    // Assert
    expect(onActive).toMatchObject({ code: 'offers.publish-invalid', problems: ['targets'] });
    expect(onPaused).toBeInstanceOf(OfferPublishInvalidError);
    await expect(service.get(ctx, scopeA, offer.id)).resolves.toEqual(paused);
  });

  it('lets a draft be saved incomplete', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const saved = await service.update(ctx, scopeA, draft.id, { targets: [], endsAt: at(-5).toISOString() });

    // Assert
    expect(saved).toMatchObject({ status: 'draft', targets: [], endsAt: at(-5), version: 2 });
  });

  it('archives a draft, an active and a paused offer, and nothing after', async () => {
    // Arrange
    const { service, lifecycle, offer, setNow } = await setUpPublished();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    const paused = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    await lifecycle.publish(ctx, scopeA, paused.id);
    await lifecycle.pause(ctx, scopeA, paused.id);
    setNow(at(9));

    // Act
    const archived = [];
    for (const id of [draft.id, offer.id, paused.id]) archived.push(await lifecycle.archive(ctx, scopeA, id));
    const again = await rejectionOf(lifecycle.archive(ctx, scopeA, offer.id));
    const republished = await rejectionOf(lifecycle.publish(ctx, scopeA, draft.id));

    // Assert
    for (const moved of archived) expect(moved).toMatchObject({ status: 'archived', archivedAt: at(9) });
    expect(again).toBeInstanceOf(InvalidOfferTransitionError);
    expect(republished).toBeInstanceOf(InvalidOfferTransitionError);
  });
});
