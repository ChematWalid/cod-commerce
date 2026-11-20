import { describe, expect, it } from 'vitest';
import { isInSchedule } from '../../../domain/engine/schedule';
import { anOffer, at, T0 } from '../../support/builders';

describe('isInSchedule', () => {
  it('skips an offer before startsAt as not_started', () => {
    // Arrange
    const offer = anOffer({ startsAt: at(1) });

    // Act
    const result = isInSchedule(offer, T0);

    // Assert
    expect(result).toBe('not_started');
  });

  it('skips an offer at endsAt as ended', () => {
    // Arrange
    const offer = anOffer({ startsAt: at(-10), endsAt: T0 });

    // Act
    const result = isInSchedule(offer, T0);

    // Assert
    expect(result).toBe('ended');
  });

  it('applies an offer at startsAt and just before endsAt', () => {
    // Arrange
    const offer = anOffer({ startsAt: T0, endsAt: at(1) });

    // Act
    const atStart = isInSchedule(offer, T0);
    const beforeEnd = isInSchedule(offer, new Date(at(1).getTime() - 1));

    // Assert
    expect([atStart, beforeEnd]).toEqual([null, null]);
  });

  it('starts an offer with no startsAt at publishedAt', () => {
    // Arrange
    const offer = anOffer({ startsAt: null, publishedAt: at(5) });

    // Act
    const before = isInSchedule(offer, at(4));
    const after = isInSchedule(offer, at(5));

    // Assert
    expect([before, after]).toEqual(['not_started', null]);
  });

  it('keeps an offer with no endsAt open', () => {
    // Arrange
    const offer = anOffer({ endsAt: null });

    // Act
    const result = isInSchedule(offer, at(60 * 24 * 365));

    // Assert
    expect(result).toBeNull();
  });
});
