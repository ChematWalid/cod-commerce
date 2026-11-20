import { GENERATE_CODE_ROUNDS, GENERATED_CODE_ALPHABET, GENERATED_CODE_LENGTH } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { assembleCodes } from '../../domain/code-generation';
import {
  CodeMethodRequiredError,
  CodeTakenError,
  InvalidOfferConfigError,
  InvalidOfferTransitionError,
} from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import type { RandomCodeSource } from '../../domain/ports/random-code-source.port';
import { CryptoCodeSource } from '../../infrastructure/crypto-code-source';
import { ScriptedCodeSource, stuckCodeSource } from '../fakes/scripted-code-source';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

/** A code offer of store A over `random`, and the services around it. */
async function setUpCodeOffer(random: RandomCodeSource = new ScriptedCodeSource()) {
  const setUp = setUpOfferAdmin({ random });
  const offer = await setUp.service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
  return { ...setUp, offer };
}

describe('assembleCodes (D2512)', () => {
  it('draws prefixed candidates and drops repeats and excluded ones', () => {
    // Arrange
    const source = new ScriptedCodeSource(['AAAAAAAA', 'AAAAAAAA', 'BBBBBBBB', 'CCCCCCCC']);

    // Act
    const codes = assembleCodes(source, { prefix: 'VIP', count: 4 }, new Set(['VIPBBBBBBBB']));

    // Assert
    expect(codes).toEqual(['VIPAAAAAAAA', 'VIPCCCCCCCC']);
  });

  it('draws from the crypto source in the alphabet and length', () => {
    // Arrange
    const source = new CryptoCodeSource();

    // Act
    const draws = Array.from({ length: 50 }, () => source.next(GENERATED_CODE_ALPHABET, GENERATED_CODE_LENGTH));

    // Assert
    for (const draw of draws) expect(draw).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });
});

describe('OfferCodesService.generate (D2512)', () => {
  it('generates 20 unique uppercase codes from the alphabet', async () => {
    // Arrange
    const { codeBook, offer } = await setUpCodeOffer(new CryptoCodeSource());

    // Act
    const codes = await codeBook.generate(ctx, scopeA, offer.id, { count: 20, prefix: 'VIP' });

    // Assert
    expect(codes).toHaveLength(20);
    expect(new Set(codes.map((code) => code.code)).size).toBe(20);
    for (const { code } of codes) expect(code).toMatch(/^VIP[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    await expect(codeBook.list(ctx, scopeA, offer.id)).resolves.toHaveLength(20);
  });

  it('redraws a candidate the store already has', async () => {
    // Arrange
    const random = new ScriptedCodeSource(['TAKEN111', 'FRESH222']);
    const { codeBook, offer } = await setUpCodeOffer(random);
    await codeBook.add(ctx, scopeA, offer.id, [{ code: 'TAKEN111' }]);

    // Act
    const codes = await codeBook.generate(ctx, scopeA, offer.id, { count: 2 });

    // Assert
    expect(codes.map((code) => code.code)).toEqual(['FRESH222', 'AAAAAAAB']);
    await expect(codeBook.list(ctx, scopeA, offer.id)).resolves.toHaveLength(3);
  });

  it('fails code-taken after three colliding rounds', async () => {
    // Arrange
    const stuck = stuckCodeSource('STUCK123');
    const draws: string[] = [];
    const { codeBook, offer } = await setUpCodeOffer({
      next: (alphabet, length) => {
        const draw = stuck.next(alphabet, length);
        draws.push(draw);
        return draw;
      },
    });
    await codeBook.add(ctx, scopeA, offer.id, [{ code: 'STUCK123' }]);

    // Act
    const generated = await rejectionOf(codeBook.generate(ctx, scopeA, offer.id, { count: 1 }));

    // Assert
    expect(generated).toBeInstanceOf(CodeTakenError);
    expect(draws).toHaveLength(GENERATE_CODE_ROUNDS);
    await expect(codeBook.list(ctx, scopeA, offer.id)).resolves.toHaveLength(1);
  });

  it('stores the per-code usage limit', async () => {
    // Arrange
    const { codeBook, offer } = await setUpCodeOffer();

    // Act
    const codes = await codeBook.generate(ctx, scopeA, offer.id, { count: 3, usageLimit: 5 });

    // Assert
    expect(codes.map((code) => code.usageLimit)).toEqual([5, 5, 5]);
    const stored = await codeBook.list(ctx, scopeA, offer.id);
    expect(stored.map((code) => code.usageLimit)).toEqual([5, 5, 5]);
  });

  it('refuses generation on an automatic offer', async () => {
    // Arrange
    const { service, codeBook } = setUpOfferAdmin();
    const automatic = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const generated = await rejectionOf(codeBook.generate(ctx, scopeA, automatic.id, { count: 1 }));

    // Assert
    expect(generated).toBeInstanceOf(CodeMethodRequiredError);
  });

  it('refuses a bad count or prefix and an archived offer', async () => {
    // Arrange
    const { codeBook, lifecycle, offer } = await setUpCodeOffer();

    // Act
    const none = await rejectionOf(codeBook.generate(ctx, scopeA, offer.id, { count: 0 }));
    const lower = await rejectionOf(codeBook.generate(ctx, scopeA, offer.id, { count: 1, prefix: 'vip' }));
    await lifecycle.archive(ctx, scopeA, offer.id);
    const archived = await rejectionOf(codeBook.generate(ctx, scopeA, offer.id, { count: 1 }));

    // Assert
    expect([none, lower].every((refusal) => refusal instanceof InvalidOfferConfigError)).toBe(true);
    expect(archived).toBeInstanceOf(InvalidOfferTransitionError);
  });
});
