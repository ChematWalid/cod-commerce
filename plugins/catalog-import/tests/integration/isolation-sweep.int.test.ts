import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { IMPORTS_EXPORTS_JOB_KINDS, toBusinessId, toStoreId } from '@cod/shared';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, rawTestId } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { JOB_REPOSITORY, JOB_SCAN } from '../../application/tokens';
import type { JobRepositoryPort, JobRowSource, JobScanPort } from '../../application/ports/job-repository.port';
import { JOB_ERROR_CODES } from '../../domain/constants';
import type { ImportsExportsJobData } from '../../domain/imports-exports-job';
import { ownRowSourceOf } from '../../infrastructure/job-row-sources';
import { JobStoreContext, type OpenedJob } from '../../infrastructure/job-store-context';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIds,
} from './endpoint-registry';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

/** Opens a job as the worker does, through catalog-import's own row source of its kind (D2252). */
function openJob(data: ImportsExportsJobData): Promise<OpenedJob | undefined> {
  const scan = suite.kit.app.get<JobScanPort>(JOB_SCAN);
  const jobs = suite.kit.app.get<JobRepositoryPort>(JOB_REPOSITORY);
  const rows: JobRowSource | undefined = ownRowSourceOf(data.kind, { scan, jobs });
  if (rows === undefined) throw new Error(`no row source for ${data.kind}`);
  return suite.kit.app.get(JobStoreContext).open(data, rows, false);
}
/** Text no answer may carry: SQL, table names, stacks, bucket names (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /catalog_import/, /catalog_export/, /cod-private/, /EntityNotFound/];
const NO_CODE = 'NO_CODE';
const SYNTHETIC_TITLE_OF_B = 'Synthetic product of B';

interface Outcome {
  readonly code: string | undefined;
  readonly data: unknown;
  readonly text: string;
}

interface ClientErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[] };
}

async function callOperation(entry: OperationEntry, ids: TargetIds): Promise<Outcome> {
  try {
    const data = await suite.kit.client.query<Record<string, unknown>>(gql(entry.document), entry.variables(ids));
    return { code: undefined, data: data[entry.operation], text: JSON.stringify(data) };
  } catch (error: unknown) {
    const { response } = error as ClientErrorShape;
    return {
      code: response?.errors?.[0]?.extensions?.code ?? NO_CODE,
      data: null,
      text: JSON.stringify(response ?? null),
    };
  }
}

/** The per-product errors of a `reported` answer (D2213). */
const reportedErrorsOf = (data: unknown): unknown[] =>
  ((data as { results?: { error?: unknown }[] } | null)?.results ?? []).map((result) => result.error);

/** The ids of B's product as an answer could spell them: the GraphQL `ID` and the database id, quoted. */
const productSpellingsOf = (ids: TargetIds): string[] => [`"${ids.productId}"`, `"${rawTestId(ids.productId)}"`];

function expectForeign(entry: { foreign: string; notFound: string }, outcome: Outcome, ids: TargetIds): void {
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  else if (entry.foreign === 'reported') expect(reportedErrorsOf(outcome.data)).toEqual([entry.notFound]);
  else if (entry.foreign === 'own-only') {
    expect(outcome.code).toBeUndefined();
    for (const spelling of productSpellingsOf(ids)) expect(outcome.text).not.toContain(spelling);
  } else expect(outcome.code).toBe(entry.notFound);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

/** The status of B's target product, read as B's owner. */
async function statusOfB(productId: string): Promise<string | undefined> {
  await suite.kit.asOwner(suite.fixtures.b);
  return (await suite.kit.product(productId))?.status;
}

describe('catalog-import isolation sweep (two businesses)', () => {
  let idsOfB: TargetIds;

  beforeAll(async () => {
    const { b } = suite.fixtures;
    const store = b.stores[0].id;
    await suite.kit.asOwner(b);
    const product = await suite.kit.createProduct({ title: SYNTHETIC_TITLE_OF_B });
    idsOfB = {
      productId: product.id,
      importId: await suite.kit.plantJob({
        table: 'catalog_import_job',
        businessId: b.businessId,
        storeId: store,
        status: 'confirming',
      }),
      exportId: await suite.kit.plantJob({
        table: 'catalog_export_job',
        businessId: b.businessId,
        storeId: store,
        status: 'queued',
      }),
    };
  });

  it.each(OPERATION_REGISTRY)("$operation as A against B's ids answers $foreign", async (entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, idsOfB);

    // Assert
    expectForeign(entry, outcome, idsOfB);
    expect(await statusOfB(idsOfB.productId)).toBe('active');
  });

  it.each(ROUTE_REGISTRY.filter((entry) => entry.foreign === 'reported'))(
    "$method $route as A against B's product ids reports them not found and leaves B unchanged",
    async (entry: RouteEntry) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(idsOfB), entry.body?.(idsOfB));

      // Assert
      expect(answer.status).toBe(200);
      expectForeign(entry, { code: undefined, data: answer.body, text: answer.text }, idsOfB);
      expect(await statusOfB(idsOfB.productId)).toBe('active');
    },
  );

  it.each(OPERATION_REGISTRY.filter((entry) => entry.foreign === 'reported'))(
    "$operation as A on A's own product changes it (positive control)",
    async (entry) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);
      const own = await suite.kit.createProduct();

      // Act
      const outcome = await callOperation(entry, { ...idsOfB, productId: own.id });

      // Assert
      expect(reportedErrorsOf(outcome.data)).toEqual([null]);
      expect((await suite.kit.product(own.id))?.status).toBe('draft');
    },
  );

  it.each(ROUTE_REGISTRY.filter((entry) => entry.foreign === 'own-only'))(
    "$method $route as A against B's ids answers about A's store only",
    async (entry: RouteEntry) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(idsOfB), entry.body?.(idsOfB));

      // Assert
      expect(answer.status).toBe(200);
      expectForeign(entry, { code: undefined, data: answer.body, text: answer.text }, idsOfB);
    },
  );

  it.each(ROUTE_REGISTRY.filter((entry) => entry.foreign === 'not-found'))(
    "$method $route as A against B's ids answers 404",
    async (entry: RouteEntry) => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(idsOfB), entry.body?.(idsOfB));

      // Assert
      expect(answer.status).toBe(404);
      expectForeign(
        entry,
        { code: (answer.body as { code?: string } | null)?.code, data: answer.body, text: answer.text },
        idsOfB,
      );
    },
  );

  it.each(
    OPERATION_REGISTRY.length === 0
      ? []
      : ([
          ["B's channel", (): string => suite.fixtures.b.stores[0].channelToken, 'FORBIDDEN'],
          ['the default channel', (): string => PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, 'FORBIDDEN'],
          ['an unknown token', (): string => 'synthetic-unknown-channel-token', 'CHANNEL_NOT_FOUND'],
        ] as const),
  )('refuses A on %s', async (_name, token, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(token());

    // Act
    const outcome = await callOperation(OPERATION_REGISTRY[0] as OperationEntry, idsOfB);

    // Assert
    expect(outcome.code).toBe(code);
  });

  it.each([
    ['import', 'catalog_import_job', (): string => idsOfB.importId],
    ['export', 'catalog_export_job', (): string => idsOfB.exportId],
  ] as const)("A's scope cannot fail or touch B's %s job row", async (table, sqlTable, id) => {
    // Arrange
    const { a } = suite.fixtures;
    const jobs = suite.kit.app.get<JobRepositoryPort>(JOB_REPOSITORY);
    const scopeOfA = { businessId: toBusinessId(a.businessId), storeId: toStoreId(a.stores[0].id) };

    // Act
    await jobs.markFailed(scopeOfA, { table, id: id() }, { errorCode: JOB_ERROR_CODES.FAILED, at: new Date() });
    await jobs.touch(scopeOfA, { table, id: id() }, new Date());

    // Assert
    expect(await suite.kit.jobRow(sqlTable, id())).toMatchObject({ errorCode: null });
  });

  it("a queued job whose payload names A for B's row fails B's row and opens no store", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    const id = await suite.kit.plantJob({
      table: 'catalog_export_job',
      businessId: b.businessId,
      storeId: b.stores[0].id,
      status: 'queued',
    });

    // Act
    const opened = await openJob({
      jobId: `cex-${id}`,
      kind: IMPORTS_EXPORTS_JOB_KINDS.productExport,
      recordId: id,
      businessId: a.businessId,
      storeId: a.stores[0].id,
    });

    // Assert
    expect(opened).toBeUndefined();
    expect(await suite.kit.jobRow('catalog_export_job', id)).toEqual({
      status: 'failed',
      errorCode: JOB_ERROR_CODES.SCOPE_MISMATCH,
    });
  });

  it("opens B's own job in B's store (positive control)", async () => {
    // Arrange
    const { b } = suite.fixtures;

    // Act
    const opened = await openJob({
      jobId: `cim-${idsOfB.importId}`,
      kind: IMPORTS_EXPORTS_JOB_KINDS.productImport,
      recordId: idsOfB.importId,
      businessId: b.businessId,
      storeId: b.stores[0].id,
    });

    // Assert
    expect(opened?.scope).toEqual({ businessId: b.businessId, storeId: b.stores[0].id });
  });
});
