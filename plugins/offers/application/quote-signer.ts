import { randomBytes } from 'node:crypto';
import { QUOTE_NONCE_BYTES, type PricingChannel } from '@cod/shared';
import { InvalidQuoteKeysError, type QuoteKeyRing } from '@cod/shared/quote-keys';
import type { PricingDestination } from '../domain/cart';
import type { PricedQuote } from '../domain/engine/priced-quote';
import { MS_PER_SECOND } from '../domain/constants';
import type { Clock } from '../domain/ports/clock.port';
import type { StoreScope } from '../domain/store-scope';
import { cartHash, type CartHashLine, phoneKey } from '../domain/token/cart-hash';
import { signQuote, type QuoteVerification, type SignedQuote, verifyQuoteToken } from '../domain/token/quote-token';

/** What the quote signer is built from: the key ring, the clock and the nonce source (both injected for tests). */
export interface QuoteSignerDeps {
  readonly ring: QuoteKeyRing;
  readonly clock: Clock;
  readonly nonce: () => string;
}

/** The cart a token commits to, as the buyer sent it: `h` covers it (D2421); the phone is E.164 or null. */
export interface TokenCart {
  readonly channel: PricingChannel;
  readonly lines: readonly CartHashLine[];
  readonly destination: PricingDestination;
  readonly codes: readonly string[];
  readonly phone: string | null;
}

/** A 96-bit random nonce, base64url: the token's `n` (D2421). */
export const randomQuoteNonce = (): string => randomBytes(QUOTE_NONCE_BYTES).toString('base64url');

/**
 * Signs and verifies the quotes of a store (ADR 0004, D2421) over the pure token functions: it reads the clock and the
 * nonce, keys the phone with the active kid when an applied offer read it, and checks a token against the store the
 * request resolved and the cart it submits.
 */
export class QuoteSigner {
  constructor(private readonly deps: QuoteSignerDeps) {}

  /**
   * The token of `priced` for `scope`, committing to `cart`.
   *
   * @throws {InvalidQuoteKeysError} when the ring has no key for its active kid.
   */
  sign(scope: StoreScope, priced: PricedQuote, cart: TokenCart): SignedQuote {
    const phone = priced.phoneUsed ? cart.phone : null;
    const payload = {
      b: scope.businessId,
      s: scope.storeId,
      h: cartHash({ ...cart, phoneKey: phone === null ? null : phoneKey(this.activeKey(), phone) }),
      p: phone === null ? (0 as const) : (1 as const),
      t: priced.total,
      sh: priced.delivery.price,
      l: priced.tokenLines.map((line) => ({ ...line, offerIds: [...line.offerIds] })),
      d: [...priced.tokenDiscounts],
      o: [...priced.tokenUses],
      a: [],
    };
    return signQuote({ ring: this.deps.ring, payload, issuedAt: this.epochSeconds(), nonce: this.deps.nonce() });
  }

  /** The verdict on `token` for `scope` and the submitted `cart`, at the clock's instant; never throws on a token. */
  verify(scope: StoreScope, token: string, cart: TokenCart): QuoteVerification {
    return verifyQuoteToken({
      ring: this.deps.ring,
      token,
      now: this.epochSeconds(),
      expect: {
        businessId: scope.businessId,
        storeId: scope.storeId,
        phone: cart.phone,
        cartHashFor: (key) => cartHash({ ...cart, phoneKey: key }),
      },
    });
  }

  private activeKey(): string {
    const { activeKid } = this.deps.ring;
    const key = this.deps.ring.keyOf(activeKid);
    if (key === undefined) throw new InvalidQuoteKeysError(`the active kid ${activeKid} has no key`);
    return key;
  }

  private epochSeconds(): number {
    return Math.floor(this.deps.clock.now().getTime() / MS_PER_SECOND);
  }
}
