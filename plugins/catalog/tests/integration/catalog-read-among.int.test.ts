import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { TransactionalConnection } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { rawId } from './catalog-kit';
import { CatalogReadProbePlugin, type ProbedIdPage } from './catalog-read-probe';
import { factsSuite } from './facts-kit';

const suite = factsSuite(1020, {
  plugins: [RbacPlugin, CatalogReadProbePlugin],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});

const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999'];

async function probe(route: 'among' | 'list-among', ids: readonly string[], skip = 0): Promise<ProbedIdPage> {
  const answer = await suite.kit.rest('GET', `/test/catalog-read/${route}?ids=${ids.join(',')}&skip=${String(skip)}`);
  expect(answer.status).toBe(200);
  return answer.body as ProbedIdPage;
}

/** Products of the signed-in caller's store, one per title, as database ids. */
async function created(...inputs: readonly Record<string, unknown>[]): Promise<string[]> {
  const ids: string[] = [];
  for (const input of inputs) ids.push(rawId((await suite.kit.createProduct(input)).id));
  return ids;
}

/** Runs `work` and collects the parameters of every SQL statement it sent. */
async function parametersOf(work: () => Promise<unknown>): Promise<unknown[]> {
  const { logger } = suite.app.get(TransactionalConnection).rawConnection;
  const original = logger.logQuery.bind(logger);
  const seen: unknown[] = [];
  logger.logQuery = (query, parameters, runner) => {
    seen.push(...((parameters ?? []) as unknown[]).flat());
    original(query, parameters, runner);
  };
  try {
    await work();
  } finally {
    logger.logQuery = original;
  }
  return seen;
}

describe('CatalogReadService among given products on a live server (D2310)', () => {
  it('keeps the given order of A1’s products and leaves drafts out', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const [first, draft, second, third] = await created(
      { title: 'Among first' },
      { title: 'Among draft', status: 'draft' },
      { title: 'Among second' },
      { title: 'Among third' },
    );
    const ids = [third, draft, first, second].map(String);

    // Act
    const page = await probe('among', ids);
    const skipped = await probe('among', ids, 1);

    // Assert
    expect(page).toEqual({ ids: [third, first, second], totalItems: 3 });
    expect(skipped.ids).toEqual([first, second]);
  });

  it("leaves out B's and A2's product ids and counts only A1's visible ones", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const [foreign] = await created({ title: 'Among foreign' });
    await suite.kit.asOwner(a, a.stores[1]);
    const [otherStore] = await created({ title: 'Among other store' });
    await suite.kit.asOwner(a);
    const [own, hidden] = await created({ title: 'Among own' }, { title: 'Among hidden', status: 'hidden' });
    const ids = [String(foreign), String(own), String(otherStore), String(hidden)];

    // Act
    const among = await probe('among', ids);
    const listed = await probe('list-among', ids);

    // Assert
    expect(among).toEqual({ ids: [own], totalItems: 1 });
    expect(listed).toEqual({ ids: [own], totalItems: 1 });
  });

  it('a malformed id is left out and never reaches Postgres', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const [own] = await created({ title: 'Among malformed' });
    let among: ProbedIdPage | undefined;
    let listed: ProbedIdPage | undefined;

    // Act
    const sent = await parametersOf(async () => {
      among = await probe('among', [...MALFORMED_IDS, String(own)]);
      listed = await probe('list-among', [...MALFORMED_IDS, String(own)]);
    });

    // Assert
    expect(among).toEqual({ ids: [own], totalItems: 1 });
    expect(listed).toEqual({ ids: [own], totalItems: 1 });
    for (const malformed of MALFORMED_IDS) expect(sent.map(String)).not.toContain(malformed);
  });

  it('listVisible with productIds keeps newest-first order', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const [older, middle, newer] = await created(
      { title: 'Among older' },
      { title: 'Among middle' },
      { title: 'Among newer' },
    );

    // Act
    const page = await probe('list-among', [String(older), String(newer), String(middle)]);

    // Assert
    expect(page).toEqual({ ids: [newer, middle, older], totalItems: 3 });
  });
});
