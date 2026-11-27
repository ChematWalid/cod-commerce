import { DELIVERY_PRICING_ERROR_CODES, PRICING_CSV_COLUMNS, PRICING_CSV_MAX_BYTES, WILAYA_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ctx, groupInput, STORE_A1, STORE_A2, STORE_B1, world } from '../support/world';

const C = DELIVERY_PRICING_ERROR_CODES;
const HEADER = PRICING_CSV_COLUMNS.join(',');
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const csv = (...rows: string[]): Uint8Array => utf8([HEADER, ...rows].join('\r\n'));

/** A group of STORE_A1 at 600 home / 400 desk everywhere, with an Alger-Centre override at 450. */
async function pricedGroup(w: ReturnType<typeof world>) {
  const group = await w.saving.create(ctx, STORE_A1, groupInput());
  const row = { codeOns: 1601, homePrice: 450, deskPrice: null, deliveryEnabled: null, deskEnabled: null };
  await w.communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [row] });
  return (await w.reads.get(ctx, STORE_A1, group.id)) ?? group;
}

describe('PricingCsvExportService', () => {
  it('exports the store group as UTF-8 CSV with a byte order mark, one row per wilaya and stored commune', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const file = await w.csvExport.export(ctx, STORE_A1, group.id);

    // Assert
    const text = new TextDecoder().decode(file?.bytes.slice(3));
    const lines = text.trimEnd().split('\r\n');
    expect([...(file?.bytes.slice(0, 3) ?? [])]).toEqual([0xef, 0xbb, 0xbf]);
    expect(file?.fileName).toBe(`delivery-pricing-${group.id}.csv`);
    expect(lines).toHaveLength(1 + WILAYA_CODES.length + 1);
    expect(lines).toContain('wilaya,16,,600,400,true,true');
    expect(lines).toContain('commune,16,1601,450,,,');
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers nothing for a group of %s', async (_label, scope) => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act and Assert
    expect(await w.csvExport.export(ctx, scope, group.id)).toBeUndefined();
  });

  it('answers nothing for a malformed id', async () => {
    // Act and Assert
    expect(await world().csvExport.export(ctx, STORE_A1, 'abc')).toBeUndefined();
  });
});

describe('PricingCsvImportService', () => {
  it('answers the diff of a dry run and writes nothing', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const report = await w.csvImport.import(ctx, STORE_A1, group.id, {
      bytes: csv('wilaya,16,,650,400,true,true', 'commune,16,1652,480,,,'),
      dryRun: true,
    });

    // Assert
    expect(report).toMatchObject({ dryRun: true, applied: false, rows: 2, issues: [], group: null });
    expect(report.changes.map((change) => change.codeOns)).toEqual([null, 1652]);
    expect(await w.reads.get(ctx, STORE_A1, group.id)).toEqual(group);
  });

  it('applies in the locked group: overrides over the kept bases, a commune not named kept', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const report = await w.csvImport.import(ctx, STORE_A1, group.id, {
      bytes: csv('wilaya,16,,650,400,true,false', 'commune,16,1652,480,,,'),
      dryRun: false,
    });

    // Assert
    const alger = report.group?.rates.find((row) => row.provinceCode === '16');
    expect(report).toMatchObject({ dryRun: false, applied: true, issues: [] });
    expect(alger).toMatchObject({ baseHome: 500, overrideHome: 650, overrideDesk: null, deskEnabled: false });
    expect(report.group?.communeRates.map((row) => row.codeOns).sort()).toEqual([1601, 1652]);
    expect(w.groups.locked).toContain(group.id);
  });

  it('writes nothing when nothing changes', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const report = await w.csvImport.import(ctx, STORE_A1, group.id, {
      bytes: csv('wilaya,16,,600,400,true,true'),
      dryRun: false,
    });

    // Assert
    expect(report).toMatchObject({ applied: true, changes: [] });
    expect(report.group?.updatedAt).toEqual(group.updatedAt);
  });

  it('refuses to apply a file with refused rows, writing none of its rows', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);
    const bytes = csv('wilaya,16,,650,400,true,true', 'commune,16,101,480,,,');

    // Act
    const applied = w.csvImport.import(ctx, STORE_A1, group.id, { bytes, dryRun: false });

    // Assert
    await expect(applied).rejects.toMatchObject({ code: C.CSV_INVALID_ROWS });
    expect(await w.reads.get(ctx, STORE_A1, group.id)).toEqual(group);
  });

  it('lists the refused rows in a dry run', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const report = await w.csvImport.import(ctx, STORE_A1, group.id, {
      bytes: csv('commune,16,101,480,,,'),
      dryRun: true,
    });

    // Assert
    expect(report.issues).toEqual([{ row: 2, column: 'codeOns', issue: 'commune-not-in-wilaya' }]);
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s, dry run or not', async (_label, scope) => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);
    const bytes = csv('wilaya,16,,650,400,true,true');

    // Act and Assert
    for (const dryRun of [true, false]) {
      await expect(w.csvImport.import(ctx, scope, group.id, { bytes, dryRun })).rejects.toMatchObject({
        code: C.NOT_FOUND,
      });
    }
    expect(await w.reads.get(ctx, STORE_A1, group.id)).toEqual(group);
  });

  it('answers not found for a malformed id', async () => {
    // Act and Assert
    await expect(world().csvImport.import(ctx, STORE_A1, '-1', { bytes: csv(), dryRun: true })).rejects.toMatchObject({
      code: C.NOT_FOUND,
    });
  });

  it('refuses a file above the byte cap', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const imported = w.csvImport.import(ctx, STORE_A1, group.id, {
      bytes: new Uint8Array(PRICING_CSV_MAX_BYTES + 1),
      dryRun: true,
    });

    // Assert
    await expect(imported).rejects.toMatchObject({ code: C.CSV_TOO_LARGE });
  });

  it("caps the rows at the group's wilayas, their communes in geo and the header", async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);
    const fill = Array.from({ length: WILAYA_CODES.length + 3 }, () => 'wilaya,16,,650,400,true,true');

    // Act
    const atCap = w.csvImport.import(ctx, STORE_A1, group.id, { bytes: csv(...fill), dryRun: true });
    const pastCap = w.csvImport.import(ctx, STORE_A1, group.id, { bytes: csv(...fill, 'x'), dryRun: true });

    // Assert
    await expect(atCap).resolves.toMatchObject({ dryRun: true });
    await expect(pastCap).rejects.toMatchObject({ code: C.CSV_TOO_MANY_ROWS });
  });

  it('refuses bytes that are not UTF-8 as an invalid file', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const imported = w.csvImport.import(ctx, STORE_A1, group.id, {
      bytes: new Uint8Array([...csv('commune,16,1652,480,,,'), 0xe9]),
      dryRun: true,
    });

    // Assert
    await expect(imported).rejects.toMatchObject({ code: C.CSV_INVALID_FILE });
  });
});
