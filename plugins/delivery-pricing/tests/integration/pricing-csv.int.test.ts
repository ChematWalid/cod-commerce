import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { DELIVERY_PRICING_ERROR_CODES, PRICING_CSV_MAX_BYTES, WILAYA_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  communeRow,
  deliveryPricingSuite,
  type GraphqlAnswer,
  type GroupResult,
  pricingCsv,
  SET_COMMUNES,
} from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const D = DELIVERY_PRICING_ERROR_CODES;
const EXPORT = 'query ($id: String!) { deliveryFeeGroupCsv(id: $id) { fileName content } }';
const IMPORT = `mutation ($groupId: String!, $file: Upload!, $dryRun: Boolean) {
  importDeliveryFeeGroupCsv(groupId: $groupId, file: $file, dryRun: $dryRun) {
    dryRun applied rows totalIssues
    changes { level provinceCode codeOns before { homePrice deskPrice deliveryEnabled deskEnabled }
      after { homePrice deskPrice deliveryEnabled deskEnabled } }
    issues { row column issue }
    group { id communeRates { codeOns homePrice } rates { provinceCode homePrice overridden } }
  }
}`;
/** Text no answer may carry: SQL, entity names, stacks, or a value the file held (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /delivery_fee/, /EntityNotFound/, /\bat \//, /9137/];

interface ImportResult {
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly rows: number;
  readonly totalIssues: number;
  readonly changes: readonly { readonly codeOns: number | null; readonly after: unknown }[];
  readonly issues: readonly { readonly row: number; readonly column: string | null; readonly issue: string }[];
  readonly group: GroupResult | null;
}

/** A group of the caller's store at 600 home everywhere, with an Alger-Centre override at 450. */
async function pricedGroup(name = 'CSV'): Promise<GroupResult> {
  const group = await suite.kit.createGroup(name);
  await suite.kit.gql(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 450)] });
  return group;
}

/** The GraphQL import as the signed-in caller: the result, or the first error code. */
async function importCsv(groupId: string, bytes: Uint8Array, dryRun?: boolean) {
  const variables = dryRun === undefined ? { groupId } : { groupId, dryRun };
  const answer = await suite.kit.upload(IMPORT, variables, bytes);
  const body = answer.body as GraphqlAnswer;
  return {
    result: (body.data?.['importDeliveryFeeGroupCsv'] ?? null) as ImportResult | null,
    code: body.errors?.[0]?.extensions?.code,
    text: answer.text,
  };
}

const algerHome = (group: GroupResult | null) => group?.rates.find((rate) => rate.provinceCode === '16')?.homePrice;

describe('pricing CSV export', () => {
  it('exports a group over GraphQL: the header, one row per wilaya and each stored commune', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();

    // Act
    const { deliveryFeeGroupCsv } = await suite.kit.gql<{
      deliveryFeeGroupCsv: { fileName: string; content: string };
    }>(EXPORT, { id: group.id });

    // Assert
    const lines = deliveryFeeGroupCsv.content
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\r\n');
    expect(deliveryFeeGroupCsv.content.startsWith('\uFEFF')).toBe(true);
    expect(deliveryFeeGroupCsv.fileName).toBe(`delivery-pricing-${group.id}.csv`);
    expect(lines[0]).toBe('level,provinceCode,codeOns,homePrice,deskPrice,deliveryEnabled,deskEnabled');
    expect(lines).toHaveLength(1 + WILAYA_CODES.length + 1);
    expect(lines).toContain('commune,16,1601,450,,,');
  });

  it('downloads the same file over REST as a CSV attachment', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();

    // Act
    const answer = await suite.kit.restRaw('GET', `/delivery-fees/${group.id}/export`);

    // Assert
    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toContain('text/csv');
    expect(answer.headers.get('content-disposition')).toBe(`attachment; filename="delivery-pricing-${group.id}.csv"`);
    expect([...answer.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(answer.bytes)).toContain('wilaya,16,,600,400,true,true');
  });
});

describe('pricing CSV import', () => {
  it('answers the diff of a dry run (the default) and writes nothing', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();
    const before = await suite.kit.group(group.id);

    // Act
    const { result } = await importCsv(group.id, pricingCsv('wilaya,16,,650,400,true,true', 'commune,16,1652,480,,,'));

    // Assert
    expect(result).toMatchObject({ dryRun: true, applied: false, rows: 2, totalIssues: 0, group: null });
    expect(result?.changes.map((change) => change.codeOns)).toEqual([null, 1652]);
    expect(await suite.kit.group(group.id)).toEqual(before);
  });

  it('applies over GraphQL: overrides written, a commune the file does not name kept', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();

    // Act
    const { result } = await importCsv(
      group.id,
      pricingCsv('wilaya,16,,650,400,true,true', 'commune,16,1652,480,,,'),
      false,
    );

    // Assert
    expect(result).toMatchObject({ dryRun: false, applied: true });
    expect(algerHome(result?.group ?? null)).toBe(650);
    expect(result?.group?.communeRates.map((row) => row.codeOns).sort()).toEqual([1601, 1652]);
  });

  it('applies a raw text/csv body over REST with ?dryRun=false, the media type in any case with a charset', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();

    // Act
    const answer = await suite.kit.restCsv(
      `/delivery-fees/${group.id}/import?dryRun=false`,
      pricingCsv('wilaya,16,,700,400,true,true'),
      'Text/CSV; charset=utf-8',
    );

    // Assert
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ applied: true, changes: [{ level: 'wilaya', provinceCode: '16' }] });
    expect(algerHome(await suite.kit.group(group.id))).toBe(700);
  });

  it('lists refused rows in a dry run, naming row, column and reason but never the value', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();

    // Act
    const { result, text } = await importCsv(
      group.id,
      pricingCsv('wilaya,16,,9137.5,400,true,true', 'commune,16,101,,,,'),
    );

    // Assert
    expect(result?.issues).toEqual([
      { row: 2, column: 'homePrice', issue: 'invalid-price' },
      { row: 3, column: 'codeOns', issue: 'commune-not-in-wilaya' },
    ]);
    for (const leak of LEAKS) expect(text).not.toMatch(leak);
  });

  it('refuses to apply a file with a refused row and writes none of its rows, on both surfaces', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();
    const before = await suite.kit.group(group.id);
    const bytes = pricingCsv('wilaya,16,,650,400,true,true', 'commune,16,9999,9137,,,');

    // Act
    const graphql = await importCsv(group.id, bytes, false);
    const rest = await suite.kit.restCsv(`/delivery-fees/${group.id}/import?dryRun=false`, bytes);

    // Assert
    expect(graphql.code).toBe(D.CSV_INVALID_ROWS);
    expect(rest).toMatchObject({ status: 400, body: { code: D.CSV_INVALID_ROWS } });
    for (const leak of LEAKS) expect(graphql.text + rest.text).not.toMatch(leak);
    expect(await suite.kit.group(group.id)).toEqual(before);
  });

  it.each([
    [
      'bytes that are not UTF-8',
      new Uint8Array([...pricingCsv('commune,16,1652,480,,,'), 0xe9]),
      400,
      D.CSV_INVALID_FILE,
    ],
    ['a file without the expected header', new TextEncoder().encode('a,b\r\n1,2'), 400, D.CSV_INVALID_FILE],
    ['a file above the byte cap', new Uint8Array(PRICING_CSV_MAX_BYTES + 1).fill(0x20), 413, D.CSV_TOO_LARGE],
  ])('refuses %s over REST and GraphQL', async (_label, bytes, status, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();

    // Act
    const rest = await suite.kit.restCsv(`/delivery-fees/${group.id}/import`, bytes);
    const graphql = await importCsv(group.id, bytes);

    // Assert
    expect(rest).toMatchObject({ status, body: { code } });
    expect(graphql.code).toBe(code);
  });

  it('refuses a file with more rows than the wilayas, their communes and the header', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();
    const [towns] = await suite.kit.query<{ n: number }>('SELECT count(*)::int AS n FROM geo_town');
    const rows = Array.from(
      { length: WILAYA_CODES.length + (towns?.n ?? 0) + 1 },
      () => 'wilaya,16,,650,400,true,true',
    );

    // Act
    const answer = await suite.kit.restCsv(`/delivery-fees/${group.id}/import`, pricingCsv(...rows));

    // Assert
    expect(answer).toMatchObject({ status: 400, body: { code: D.CSV_TOO_MANY_ROWS } });
  });

  it.each([
    ['a dry-run flag that is no boolean', '?dryRun=maybe', 'text/csv', D.INVALID_INPUT],
    ['a JSON body, which is no CSV', '', 'application/json', D.CSV_INVALID_FILE],
  ])('refuses %s over REST', async (_label, query, contentType, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();
    const body = contentType === 'text/csv' ? pricingCsv() : new TextEncoder().encode('{"rows":[]}');

    // Act
    const answer = await suite.kit.restCsv(`/delivery-fees/${group.id}/import${query}`, body, contentType);

    // Assert
    expect(answer).toMatchObject({ status: 400, body: { code } });
  });

  it.each([
    ['text/plain, which a cross-site form may send without a preflight', 'text/plain'],
    ['a body with no content type', null],
  ])('refuses %s and writes nothing, though the body is a valid CSV', async (_label, contentType) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await pricedGroup();
    const before = await suite.kit.group(group.id);

    // Act
    const answer = await suite.kit.restCsv(
      `/delivery-fees/${group.id}/import?dryRun=false`,
      pricingCsv('wilaya,16,,700,400,true,true'),
      contentType,
    );

    // Assert
    expect(answer).toMatchObject({ status: 400, body: { code: D.CSV_INVALID_FILE } });
    expect(await suite.kit.group(group.id)).toEqual(before);
  });

  it.each([
    ['another business (B)', () => [suite.fixtures.b, suite.fixtures.b.stores[0]] as const],
    ['another store of the same business (A2)', () => [suite.fixtures.a, suite.fixtures.a.stores[1]] as const],
  ])("answers not found for %s's group, dry run or not, and writes nothing", async (_label, victim) => {
    // Arrange
    const [owner, store] = victim();
    await suite.kit.asOwner(owner, store);
    const group = await pricedGroup('Victim CSV');
    const before = await suite.kit.group(group.id);
    await suite.kit.asOwner(suite.fixtures.a);
    const bytes = pricingCsv('wilaya,16,,650,400,true,true');

    // Act
    const exported = await suite.kit.gql<{ deliveryFeeGroupCsv: unknown }>(EXPORT, { id: group.id });
    const download = await suite.kit.rest('GET', `/delivery-fees/${group.id}/export`);
    const dryRun = await importCsv(group.id, bytes);
    const applied = await suite.kit.restCsv(`/delivery-fees/${group.id}/import?dryRun=false`, bytes);

    // Assert
    expect(exported.deliveryFeeGroupCsv).toBeNull();
    expect(download).toMatchObject({ status: 404, body: { code: D.NOT_FOUND } });
    expect(dryRun.code).toBe(D.NOT_FOUND);
    expect(applied).toMatchObject({ status: 404, body: { code: D.NOT_FOUND } });
    for (const leak of [...LEAKS, /Victim/]) expect(dryRun.text + applied.text + download.text).not.toMatch(leak);
    await suite.kit.asOwner(owner, store);
    expect(await suite.kit.group(group.id)).toEqual(before);
  });
});
