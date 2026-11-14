import { InvalidQuoteKeysError, type QuoteKey } from './keys';

/** The keys of the quote tokens: the active kid signs, every kid of the ring verifies (ADR 0004 rotation). */
export interface QuoteKeyRing {
  readonly activeKid: string;
  /** The kids of the ring, in the order they were listed. */
  readonly kids: readonly string[];
  /** The secret of `kid`, or undefined when the ring holds no such kid (a token signed with it fails). */
  keyOf(kid: string): string | undefined;
}

const PRINTED_AS = '[quote key ring]';

/** The ring behind {@link quoteKeyRing}. It prints as nothing, so a logged option object never shows a secret. */
class ParsedQuoteKeyRing implements QuoteKeyRing {
  readonly kids: readonly string[];

  constructor(
    readonly activeKid: string,
    private readonly secrets: ReadonlyMap<string, string>,
  ) {
    this.kids = [...secrets.keys()];
  }

  keyOf(kid: string): string | undefined {
    return this.secrets.get(kid);
  }

  toJSON(): string {
    return PRINTED_AS;
  }

  toString(): string {
    return PRINTED_AS;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return PRINTED_AS;
  }
}

/**
 * Builds the ring from parsed keys and the kid that signs.
 *
 * @throws {InvalidQuoteKeysError} when `activeKid` names no key of the ring.
 */
export function quoteKeyRing(keys: readonly QuoteKey[], activeKid: string): QuoteKeyRing {
  if (!keys.some((key) => key.kid === activeKid)) {
    throw new InvalidQuoteKeysError(`the active kid ${activeKid} is not one of the kids in the list`);
  }
  return new ParsedQuoteKeyRing(activeKid, new Map(keys.map((key) => [key.kid, key.secret])));
}
