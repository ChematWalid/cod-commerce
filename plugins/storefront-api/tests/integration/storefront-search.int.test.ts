import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { normalizeForSearch, SEARCH_NORMAL_CASES, storefrontProductPageSchema } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { idsOf, type MadeProduct, storefrontSuite } from './storefront-kit';

const suite = storefrontSuite(942, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const POLL_MS = 50;
const DEADLINE_MS = 20_000;

/** Products made once for the file: A's first store hides sold-out products. */
const made = {} as {
  active: MadeProduct;
  hidden: MadeProduct;
  draft: MadeProduct;
  soldOut: MadeProduct;
  foreign: MadeProduct;
  sabbatA: MadeProduct;
  sabbatB: MadeProduct;
};

/** Waits until the projection holds a row for every product in `ids`, sold out when `soldOut` says so. */
async function projected(ids: readonly string[], soldOut = false): Promise<void> {
  const deadline = Date.now() + DEADLINE_MS;
  for (;;) {
    const rows = await suite.kit.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM storefront_product WHERE "productId" = ANY($1::int[]) AND "soldOut" = $2',
      [ids, soldOut],
    );
    if (rows[0]?.n === ids.length) return;
    if (Date.now() > deadline) throw new Error('the projection never caught up');
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

const search = (q: string, storeId: string) =>
  suite.kit.store(`/store/product/search?q=${encodeURIComponent(q)}`, storeId);

beforeAll(async () => {
  const { kit, fixtures } = suite;
  await kit.asOwner(fixtures.b);
  made.foreign = await kit.product('Zellige foreign');
  made.sabbatB = await kit.product('سبّاط جلد');
  await kit.asOwner(fixtures.a);
  await kit.updateStore(fixtures.a.stores[0], { soldOutBehavior: 'hide' });
  made.active = await kit.product('Zellige bleu');
  made.hidden = await kit.product('Zellige hidden', { status: 'hidden' });
  made.draft = await kit.product('Zellige draft', { status: 'draft' });
  made.soldOut = await kit.product('Zellige sold out');
  await kit.updateProduct(made.soldOut.id, { settings: { soldOut: true } });
  made.sabbatA = await kit.product('سبّاط رياضي');
  await projected([made.foreign.id, made.sabbatB.id, made.active.id, made.hidden.id, made.sabbatA.id]);
  await projected([made.soldOut.id], true);
});

describe('cod_normalize_for_search', () => {
  it('equals normalizeForSearch on every row of the shared parity table', async () => {
    // Arrange
    const inputs = SEARCH_NORMAL_CASES.map((row) => row.input);

    // Act
    const rows = await suite.kit.query<{ output: string }>(
      'SELECT cod_normalize_for_search(input) AS output FROM unnest($1::text[]) WITH ORDINALITY AS t(input, at) ORDER BY at',
      [inputs],
    );

    // Assert
    expect(rows.map((row) => row.output)).toEqual(SEARCH_NORMAL_CASES.map((row) => row.expected));
    expect(rows.map((row) => row.output)).toEqual(inputs.map(normalizeForSearch));
  });

  it('is IMMUTABLE, so an index may use it', async () => {
    // Act
    const rows = await suite.kit.query<{ provolatile: string }>(
      "SELECT provolatile FROM pg_proc WHERE proname = 'cod_normalize_for_search'",
    );

    // Assert
    expect(rows).toEqual([{ provolatile: 'i' }]);
  });
});

describe('GET /store/product/search', () => {
  it("finds the store's active product and never a hidden, draft, sold-out-hidden or other business's one", async () => {
    // Act
    const answer = await search('zellige', suite.fixtures.a.stores[0].id);

    // Assert
    expect(answer.status).toBe(200);
    expect(storefrontProductPageSchema.safeParse(answer.body).success).toBe(true);
    expect(idsOf(answer)).toEqual([made.active.id]);
  });

  it.each(['', 'z', '%20%20'])('answers an empty page to the too-short query %j', async (q) => {
    // Act
    const answer = await suite.kit.store(`/store/product/search?q=${q}&take=3`, suite.fixtures.a.stores[0].id);

    // Assert
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ items: [], totalItems: 0, skip: 0, take: 3 });
  });

  it('answers a page, never an error, to a 500-character, a repeated and a right-to-left-marked query', async () => {
    // Arrange
    const storeA = suite.fixtures.a.stores[0].id;
    const rightToLeftMark = encodeURIComponent(String.fromCodePoint(0x200f));

    // Act
    const answers = await Promise.all([
      search(`zellige ${'x'.repeat(492)}`, storeA),
      suite.kit.store('/store/product/search?q=zellige&q=bleu', storeA),
      suite.kit.store(`/store/product/search?q=${rightToLeftMark}zellige`, storeA),
    ]);

    // Assert
    expect(answers.map((answer) => answer.status)).toEqual([200, 200, 200]);
    expect(answers.every((answer) => storefrontProductPageSchema.safeParse(answer.body).success)).toBe(true);
    expect(idsOf(answers[1])).toEqual([]);
    expect(idsOf(answers[2])).toEqual([made.active.id]);
  });

  it('finds an Arabic-script name from the Latin Darija word through the seeded synonyms', async () => {
    // Act
    const answer = await search('sabbat', suite.fixtures.a.stores[0].id);

    // Assert
    expect(idsOf(answer)).toEqual([made.sabbatA.id]);
  });

  it("never expands one business's query with another business's synonym", async () => {
    // Arrange: B's own synonym, written after both businesses were seeded
    const { kit, fixtures } = suite;
    await search('sabbat', fixtures.b.stores[0].id);
    await kit.query(
      `INSERT INTO storefront_search_synonym ("businessId", "storeId", id, term, expansion) VALUES ($1, NULL, $2, 'zorba', 'سباط')`,
      [fixtures.b.businessId, '990000000000000001'],
    );

    // Act
    const inA = await search('zorba', fixtures.a.stores[0].id);
    const inB = await search('zorba', fixtures.b.stores[0].id);

    // Assert
    expect(idsOf(inA)).toEqual([]);
    expect(idsOf(inB)).toEqual([made.sabbatB.id]);
  });

  it('answers 404 with an empty body to an unsigned search', async () => {
    // Act
    const answer = await suite.kit.store('/store/product/search?q=zellige');

    // Assert
    expect({ status: answer.status, text: answer.text }).toEqual({ status: 404, text: '' });
  });
});
