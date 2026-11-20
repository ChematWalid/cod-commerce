import { FlagAdminService, FlagSeedService } from '@cod/plugin-platform-flags';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { ACTIVITY_ACTIONS, CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES, FLAG_KEYS } from '@cod/shared';
import { failureOf, rawTestId } from '@cod/testing';
import gql from 'graphql-tag';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LINK_FIXTURE_URLS } from '../../infrastructure/link-fixtures';
import { OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { LINK_IMPORT_FIELDS, POLISH_FIELDS } from './link-endpoint-registry';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const C = CATALOG_IMPORT_ERROR_CODES;
/** A bound on the spend loop only: the policy's own capacity decides when it stops. */
const MAX_SPEND = 10_000;
const STAFF = 'link-import-test';
const VIEW = 'catalog.products.view';
const CREATE = 'catalog.products.create';
const LINK_STEPS = ['createCatalogLinkImport', 'catalogLinkImport'];
const SCRAPE_ROUTES = ['POST /catalog/scrape/import-job', 'POST /catalog/scrape/products/:id/polish'];

const CREATE_LINK = `mutation ($input: CatalogLinkImportInput!) { createCatalogLinkImport(input: $input) { ${LINK_IMPORT_FIELDS} } }`;
const POLISH = `mutation ($id: ID!) { polishCatalogProduct(id: $id) { ${POLISH_FIELDS} } }`;

/** A link import as both API surfaces answer it. */
interface LinkImportAnswer {
  readonly importId: string;
  readonly status: string;
  readonly sourceUrl: string;
  readonly productId: string;
}

/** The origin row of a product, read past every tenant filter. */
interface OriginRow {
  readonly source: string;
  readonly needsImageReview: boolean;
  readonly importJobId: string | null;
  readonly imageUrls: string[];
}

const createLink = async (url: string): Promise<LinkImportAnswer> =>
  (await suite.kit.gql<{ createCatalogLinkImport: LinkImportAnswer }>(CREATE_LINK, { input: { url } }))
    .createCatalogLinkImport;

const originOf = async (productId: string): Promise<OriginRow | undefined> =>
  (
    await suite.kit.query<OriginRow>(
      `SELECT "source", "needsImageReview", "importJobId", "imageUrls" FROM catalog_product_origin WHERE "productId" = $1`,
      [rawTestId(productId)],
    )
  )[0];

const countOf = async (table: string): Promise<number> =>
  Number((await suite.kit.query<{ n: string }>(`SELECT count(*) AS n FROM "${table}"`))[0]?.n);

const setAi = (enabled: boolean) =>
  suite.kit.app.get(FlagAdminService).update(STAFF, { key: FLAG_KEYS.ai, defaultEnabled: enabled });

describe('link import and the AI hooks (D2214, D2215)', () => {
  let ids: TargetIds;

  beforeAll(async () => {
    await suite.kit.app.get(FlagSeedService).converge();
    await setAi(true);
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const product = await suite.kit.createProduct({ title: 'Synthetic product of A' });
    const linkImportId = await suite.kit.plantJob({
      table: 'catalog_import_job',
      kind: 'link',
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'done',
    });
    ids = { productId: product.id, importId: linkImportId, exportId: linkImportId, linkImportId };
  });

  afterEach(async () => {
    await setAi(true);
  });

  it('fixture URL creates a Draft with needsImageReview and origin link', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await createLink(LINK_FIXTURE_URLS.kaftan);
    const product = await suite.kit.product(answer.productId);
    const origin = await originOf(answer.productId);
    const read = await suite.kit.gql<{ catalogLinkImport: LinkImportAnswer }>(
      `query ($id: String!) { catalogLinkImport(id: $id) { ${LINK_IMPORT_FIELDS} } }`,
      { id: answer.importId },
    );

    // Assert
    expect(answer).toMatchObject({ status: 'done', sourceUrl: LINK_FIXTURE_URLS.kaftan });
    expect(product?.status).toBe('draft');
    expect(product?.price).toBeGreaterThan(0);
    expect(origin).toMatchObject({ source: 'link', needsImageReview: true, importJobId: answer.importId });
    expect(origin?.imageUrls.length).toBeGreaterThan(0);
    expect(read.catalogLinkImport).toEqual(answer);
  });

  it('a page with no price makes a Draft priced 0', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await createLink(LINK_FIXTURE_URLS.noPrice);
    const product = await suite.kit.product(answer.productId);

    // Assert
    expect(product).toMatchObject({ status: 'draft', price: 0 });
  });

  it('an activity row records the link import', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await createLink(LINK_FIXTURE_URLS.kaftan);
    const rows = await suite.kit.activityOf(answer.importId);

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      businessId: suite.fixtures.a.businessId,
      storeId: suite.fixtures.a.stores[0].id,
      action: ACTIVITY_ACTIONS.CATALOG_PRODUCT_LINK_IMPORTED,
      entityType: 'catalog-job',
    });
  });

  it('a refused link answers link-refused on both surfaces, never echoes the address, and creates nothing', async () => {
    // The fixture scraper refuses every host but its own; the guard itself is proved by ssrf.test.ts and
    // http-link-scraper.test.ts. This proves the API mapping and that a refusal writes nothing.
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const before = { jobs: await countOf('catalog_import_job'), origins: await countOf('catalog_product_origin') };

    // Act
    const failure = await failureOf(createLink('http://169.254.169.254/latest/meta-data/'));
    const rest = await suite.kit.rest('POST', '/catalog/scrape/import-job', { url: 'http://127.0.0.1/' });

    // Assert
    expect(failure.codes).toEqual([C.LINK_REFUSED]);
    expect(rest).toMatchObject({ status: 400, body: { code: C.LINK_REFUSED } });
    expect(rest.text).not.toContain('127.0.0.1');
    expect({ jobs: await countOf('catalog_import_job'), origins: await countOf('catalog_product_origin') }).toEqual(
      before,
    );
  });

  it('polish returns the text unchanged', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await suite.kit.createProduct({ title: 'Polish me', description: '<p>Light</p>' });

    // Act
    const { polishCatalogProduct } = await suite.kit.gql<{
      polishCatalogProduct: { productId: string; title: string; description: string | null };
    }>(POLISH, { id: product.id });
    const rest = await suite.kit.rest('POST', `/catalog/scrape/products/${rawTestId(product.id)}/polish`, {});

    // Assert
    expect(polishCatalogProduct).toEqual({ productId: product.id, title: 'Polish me', description: '<p>Light</p>' });
    expect(rest).toMatchObject({ status: 200, body: { title: 'Polish me', description: '<p>Light</p>' } });
  });

  it('polish with ai.enabled off answers ai-disabled', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await setAi(false);

    // Act
    const failure = await failureOf(suite.kit.gql(POLISH, { id: ids.productId }));
    const rest = await suite.kit.rest('POST', `/catalog/scrape/products/${rawTestId(ids.productId)}/polish`, {});

    // Assert
    expect(failure.codes).toEqual([C.AI_DISABLED]);
    expect(rest).toMatchObject({ status: 409, body: { code: C.AI_DISABLED } });
  });

  it("polish on B's product id → not found", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const ofB = await suite.kit.createProduct({ title: 'Synthetic product of B' });
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(suite.kit.gql(POLISH, { id: ofB.id }));
    const rest = await suite.kit.rest('POST', `/catalog/scrape/products/${rawTestId(ofB.id)}/polish`, {});

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND]);
    expect(rest).toMatchObject({ status: 404, body: { code: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND } });
    expect(rest.text).not.toContain('Synthetic product of B');
  });

  it('polish needs edit (FORBIDDEN for a create-only member)', async () => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, [VIEW, CREATE]);

    // Act
    const failure = await failureOf(suite.kit.gql(POLISH, { id: ids.productId }));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it.each(OPERATION_REGISTRY.filter((entry) => LINK_STEPS.includes(entry.operation)))(
    'view-only member → FORBIDDEN on $operation',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, [VIEW]);

      // Act
      const failure = await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    },
  );

  it.each(ROUTE_REGISTRY.filter((entry) => SCRAPE_ROUTES.includes(`${entry.method} ${entry.route}`)))(
    'scrape 429 after the actor budget, with Retry-After: $method $route',
    async (entry) => {
      // Arrange: B's owner has spent the whole scrape actor budget
      const { b } = suite.fixtures;
      await suite.kit.asOwner(b);
      const [owner] = await suite.kit.query<{ userId: number }>(
        'SELECT "userId" FROM administrator WHERE "emailAddress" = $1',
        [b.owner.email],
      );
      const limiter = suite.kit.app.get(RateLimiter);
      const key = `${b.businessId}:${String(owner?.userId)}`;
      for (let spent = 0; spent < MAX_SPEND; spent += 1) {
        if (!(await limiter.consume('catalog-scrape-actor', key)).allowed) break;
      }

      // Act
      const body = new TextEncoder().encode(JSON.stringify(entry.body?.(ids) ?? {}));
      const answer = await suite.kit.restRaw('POST', entry.url(ids), body);

      // Assert
      expect(answer.status).toBe(429);
      expect(Number(answer.headers.get('retry-after'))).toBeGreaterThan(0);
    },
  );

  it("B's link job id → not found", async () => {
    // Arrange
    const { b } = suite.fixtures;
    const ofB = await suite.kit.plantJob({
      table: 'catalog_import_job',
      kind: 'link',
      businessId: b.businessId,
      storeId: b.stores[0].id,
      status: 'done',
    });
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(
      suite.kit.gql(`query ($id: String!) { catalogLinkImport(id: $id) { ${LINK_IMPORT_FIELDS} } }`, { id: ofB }),
    );
    const rest = await suite.kit.rest('GET', `/catalog/scrape/import-jobs/${ofB}`);
    const asSpreadsheet = await suite.kit.rest('GET', `/catalog/import-export/products/imports/${ids.linkImportId}`);

    // Assert
    expect(failure.codes).toEqual([C.JOB_NOT_FOUND]);
    expect(rest).toMatchObject({ status: 404, body: { code: C.JOB_NOT_FOUND } });
    expect(asSpreadsheet).toMatchObject({ status: 404, body: { code: C.JOB_NOT_FOUND } });
  });
});
