import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { IMPORTS_EXPORTS_JOB_KINDS, toBusinessId, toStoreId } from '@cod/shared';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { JOB_REPOSITORY } from '../../application/tokens';
import type { JobRepositoryPort } from '../../application/ports/job-repository.port';
import { JOB_ERROR_CODES } from '../../domain/constants';
import { JobStoreContext } from '../../infrastructure/job-store-context';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIds,
} from './endpoint-registry';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** Text no answer may carry: SQL, table names, stacks, bucket names (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /catalog_import/, /catalog_export/, /cod-private/, /EntityNotFound/];
const NO_CODE = 'NO_CODE';

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

function expectForeign(entry: { foreign?: string; notFound: string }, outcome: Outcome): void {
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  else expect(outcome.code).toBe(entry.notFound);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

describe('catalog-import isolation sweep (two businesses)', () => {
  let idsOfB: TargetIds;

  beforeAll(async () => {
    const { b } = suite.fixtures;
    const store = b.stores[0].id;
    idsOfB = {
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
    expectForeign(entry, outcome);
  });

  it.each(ROUTE_REGISTRY)("$method $route as A against B's ids answers 404", async (entry: RouteEntry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(idsOfB), entry.body?.(idsOfB));

    // Assert
    expect(answer.status).toBe(404);
    expectForeign(entry, {
      code: (answer.body as { code?: string } | null)?.code,
      data: answer.body,
      text: answer.text,
    });
  });

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
    const opened = await suite.kit.app.get(JobStoreContext).open({
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
    const opened = await suite.kit.app.get(JobStoreContext).open({
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
