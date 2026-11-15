import { describe, expect, it } from 'vitest';
import { releaseOrderUsage } from '../../../domain/engine/order-usage';
import { anOffer, aSnapshot } from '../../support/builders';

describe('releaseOrderUsage', () => {
  it('gives back one total use of each offer the order holds', () => {
    // Arrange
    const snapshot = aSnapshot({
      offers: [anOffer({ id: '7001', usageCount: 5 }), anOffer({ id: '7002', usageCount: 5 })],
    });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: ['7001'], codes: [], ownBuyer: true });

    // Assert
    expect(released.offers.map((offer) => offer.usageCount)).toEqual([4, 5]);
  });

  it('gives back one use of each code the order holds, matched after normalising', () => {
    // Arrange
    const codes = new Map([['INFLU10', { offerId: '7001', usageLimit: 1, usageCount: 1 }]]);

    // Act
    const released = releaseOrderUsage(aSnapshot({ codes }), { offerIds: [], codes: [' influ10 '], ownBuyer: true });

    // Assert
    expect(released.codes.get('INFLU10')?.usageCount).toBe(0);
  });

  it("gives back one of the buyer's uses of each offer the order holds", () => {
    // Arrange
    const snapshot = aSnapshot({
      perBuyerUsage: new Map([
        ['7001', 2],
        ['7002', 1],
      ]),
    });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: ['7001'], codes: [], ownBuyer: true });

    // Assert
    expect(released.perBuyerUsage).toEqual(
      new Map([
        ['7001', 1],
        ['7002', 1],
      ]),
    );
  });

  it('never counts below zero uses', () => {
    // Arrange
    const snapshot = aSnapshot({ offers: [anOffer({ id: '7001', usageCount: 0 })] });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: ['7001', '7001'], codes: [], ownBuyer: true });

    // Assert
    expect(released.offers[0]?.usageCount).toBe(0);
    expect(released.perBuyerUsage.get('7001')).toBeUndefined();
  });

  it('returns the snapshot unchanged when the order holds nothing', () => {
    // Arrange
    const snapshot = aSnapshot({ offers: [anOffer({ usageCount: 3 })] });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: [], codes: [], ownBuyer: true });

    // Assert
    expect(released).toBe(snapshot);
  });

  it("counts the order out of its own buyer's order history", () => {
    // Arrange
    const snapshot = aSnapshot({ buyerOrderCount: 1 });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: [], codes: [], ownBuyer: true });

    // Assert
    expect(released.buyerOrderCount).toBe(0);
  });

  it('never counts below zero orders', () => {
    // Arrange
    const snapshot = aSnapshot({ buyerOrderCount: 0 });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: [], codes: [], ownBuyer: true });

    // Assert
    expect(released.buyerOrderCount).toBe(0);
  });

  it("leaves another buyer's history and uses alone while still giving back the offer's total use", () => {
    // Arrange
    const snapshot = aSnapshot({
      offers: [anOffer({ id: '7001', usageCount: 5 })],
      perBuyerUsage: new Map([['7001', 1]]),
      buyerOrderCount: 3,
    });

    // Act
    const released = releaseOrderUsage(snapshot, { offerIds: ['7001'], codes: [], ownBuyer: false });

    // Assert
    expect(released.offers[0]?.usageCount).toBe(4);
    expect(released.perBuyerUsage.get('7001')).toBe(1);
    expect(released.buyerOrderCount).toBe(3);
  });
});
