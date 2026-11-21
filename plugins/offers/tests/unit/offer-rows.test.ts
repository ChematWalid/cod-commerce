import { describe, expect, it } from 'vitest';
import type { PricingLogger } from '../../domain/ports/pricing-logger.port';
import type { OfferEntity } from '../../infrastructure/offer.entity';
import type { OfferTargetEntity } from '../../infrastructure/offer-target.entity';
import { type OfferTargetRow, offerRowOf, targetRowsOf, toOfferRecord } from '../../infrastructure/offer-rows';
import { anActiveOffer, newId, scopeA } from '../support/offer-records';

/** A logger that keeps what it was told. */
function recordingLogger() {
  const unknownTargets: [string, string, string][] = [];
  const logger: PricingLogger = {
    unknownKind: () => undefined,
    unknownTarget: (offerId, refType, role) => unknownTargets.push([offerId, refType, role]),
    invalidConfig: () => undefined,
  };
  return { logger, unknownTargets };
}

describe('offer rows', () => {
  it('reads back the offer it wrote, targets in their order', () => {
    // Arrange
    const offer = anActiveOffer({
      targets: [
        { role: 'buy', refType: 'collection', refId: '4' },
        { role: 'buy', refType: 'variant', refId: '11' },
      ],
    });
    const { logger, unknownTargets } = recordingLogger();
    const row = { ...offerRowOf(scopeA, offer), businessId: scopeA.businessId } as OfferEntity;
    const targets = targetRowsOf(scopeA, offer, newId).reverse() as OfferTargetEntity[];

    // Act
    const read = toOfferRecord(row, targets, logger);

    // Assert
    expect(read).toEqual(offer);
    expect(unknownTargets).toEqual([]);
  });

  it('leaves out a stored target of an unknown refType', () => {
    // Arrange
    const offer = anActiveOffer();
    const { logger, unknownTargets } = recordingLogger();
    const row = { ...offerRowOf(scopeA, offer), businessId: scopeA.businessId } as OfferEntity;
    const [stored] = targetRowsOf(scopeA, offer, newId);
    const rowOf = (overrides: Partial<OfferTargetRow>) => ({ ...stored, ...overrides }) as OfferTargetEntity;
    const [kept, unknown, unknownRole] = [
      rowOf({}),
      rowOf({ refType: 'everything', position: 1 }),
      rowOf({ role: 'gift', position: 2 }),
    ];

    // Act
    const read = toOfferRecord(row, [kept, unknown, unknownRole], logger);

    // Assert
    expect(read.targets).toEqual(offer.targets);
    expect(unknownTargets).toEqual([
      [offer.id, 'everything', 'buy'],
      [offer.id, 'variant', 'gift'],
    ]);
  });
});
