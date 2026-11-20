import { describe, expect, it } from 'vitest';
import { toCodeDto, toOfferViewDto } from '../../api/offer-dto';
import { at } from '../support/builders';
import { anOfferRecord, newId } from '../support/offer-records';

describe('the offer DTOs (D2519)', () => {
  it('builds the DTO with codeCount and performance', () => {
    // Arrange
    const offer = anOfferRecord({
      status: 'active',
      startsAt: at(1),
      endsAt: null,
      publishedAt: at(2),
      targets: [{ role: 'buy', refType: 'variant', refId: '11' }],
    });
    const performance = { orders: 3, deliveredRevenue: 9_620, discountGiven: 980 };

    // Act
    const dto = toOfferViewDto({ ...offer, codeCount: 4 }, performance);

    // Assert
    expect(dto).toMatchObject({
      id: offer.id,
      kind: 'quantity',
      status: 'active',
      startsAt: at(1).toISOString(),
      endsAt: null,
      publishedAt: at(2).toISOString(),
      pausedAt: null,
      archivedAt: null,
      version: offer.version,
      targets: [{ role: 'buy', refType: 'variant', refId: '11' }],
      codeCount: 4,
      performance,
    });
    expect(Object.keys(dto)).not.toContain('createdAt');
  });

  it('gives a stored code its instant as ISO text', () => {
    // Arrange
    const code = { id: newId(), offerId: newId(), code: 'SAVE10', usageLimit: 5, usageCount: 1, createdAt: at(3) };

    // Act
    const dto = toCodeDto(code);

    // Assert
    expect(dto).toEqual({ ...code, createdAt: at(3).toISOString() });
  });
});
