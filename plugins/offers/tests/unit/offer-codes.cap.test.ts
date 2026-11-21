import { MAX_CODES_PER_ADD, MAX_CODES_PER_OFFER } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidOfferConfigError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

/** `count` distinct code inputs starting at number `from`, such as `CODE00042`. */
const codeInputs = (from: number, count: number) =>
  Array.from({ length: count }, (_unused, index) => ({ code: `CODE${String(from + index).padStart(5, '0')}` }));

/** A code offer of store A holding `held` codes, added in batches of `MAX_CODES_PER_ADD`. */
async function setUpOfferHolding(held: number) {
  const setUp = setUpOfferAdmin();
  const offer = await setUp.service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
  for (let from = 0; from < held; from += MAX_CODES_PER_ADD) {
    await setUp.codeBook.add(ctx, scopeA, offer.id, codeInputs(from, Math.min(MAX_CODES_PER_ADD, held - from)));
  }
  return { ...setUp, offer };
}

describe('OfferCodesService per-offer cap (D2535(k))', () => {
  it('fills an offer up to MAX_CODES_PER_OFFER codes', async () => {
    // Arrange
    const { codeBook, offer } = await setUpOfferHolding(MAX_CODES_PER_OFFER - 2);

    // Act
    const added = await codeBook.generate(ctx, scopeA, offer.id, { count: 2 });

    // Assert
    expect(added).toHaveLength(2);
    await expect(codeBook.list(ctx, scopeA, offer.id)).resolves.toHaveLength(MAX_CODES_PER_OFFER);
  });

  it('refuses an add or a generation that would take the offer past MAX_CODES_PER_OFFER', async () => {
    // Arrange
    const { codeBook, offer } = await setUpOfferHolding(MAX_CODES_PER_OFFER - 1);

    // Act
    const added = await rejectionOf(codeBook.add(ctx, scopeA, offer.id, codeInputs(MAX_CODES_PER_OFFER, 2)));
    const generated = await rejectionOf(codeBook.generate(ctx, scopeA, offer.id, { count: 2 }));

    // Assert
    expect(added).toBeInstanceOf(InvalidOfferConfigError);
    expect(generated).toBeInstanceOf(InvalidOfferConfigError);
    await expect(codeBook.list(ctx, scopeA, offer.id)).resolves.toHaveLength(MAX_CODES_PER_OFFER - 1);
  });
});
