import type { DeliveryFeeCsvChange } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { CsvImportDto } from '../../dashboard/dto';
import { canApplyCsv, csvCellsOf, csvIssueMessageIdOf, shownChangesOf } from '../../dashboard/model/csv-preview';

const preview = (fields: Partial<CsvImportDto> = {}): CsvImportDto => ({
  dryRun: true,
  applied: false,
  rows: 1,
  totalIssues: 0,
  issues: [],
  changes: [change()],
  group: null,
  ...fields,
});

function change(fields: Partial<DeliveryFeeCsvChange> = {}): DeliveryFeeCsvChange {
  return {
    level: 'wilaya',
    provinceCode: '16',
    codeOns: null,
    before: { homePrice: 500, deskPrice: 400, deliveryEnabled: true, deskEnabled: true },
    after: { homePrice: 650, deskPrice: 400, deliveryEnabled: true, deskEnabled: false },
    ...fields,
  };
}

const say = (id: string): string => `<${id}>`;

describe('the CSV import preview', () => {
  it('lets a preview with changes and no refused row be applied', () => {
    expect(canApplyCsv(preview())).toBe(true);
  });

  it.each([
    ['nothing previewed yet', null],
    ['a preview with a refused row', preview({ totalIssues: 1 })],
    ['a preview that changes nothing', preview({ changes: [] })],
    ['an import already applied', preview({ dryRun: false, applied: true })],
  ])('refuses to apply %s', (_label, result) => {
    expect(canApplyCsv(result)).toBe(false);
  });

  it('shows each changed value as before → after, and an unchanged one once', () => {
    // Act
    const cells = csvCellsOf(change(), say);

    // Assert
    expect(cells).toEqual({
      home: '500 → 650',
      desk: '400',
      delivery: '<delivery-pricing.csv-on>',
      deskSwitch: '<delivery-pricing.csv-on> → <delivery-pricing.csv-off>',
    });
  });

  it('shows an inherited commune value, a new commune row and a removed one', () => {
    // Arrange
    const added = change({ level: 'commune', codeOns: 1652, before: null });
    const removed = change({ level: 'commune', codeOns: 1601, after: null });

    // Act and Assert
    expect(csvCellsOf(added, say).home).toBe('<delivery-pricing.csv-inherit> → 650');
    expect(csvCellsOf(removed, say).deskSwitch).toBe('<delivery-pricing.csv-on> → <delivery-pricing.csv-inherit>');
    const inherited = { homePrice: null, deskPrice: 400, deliveryEnabled: true, deskEnabled: false };
    expect(csvCellsOf(change({ after: inherited }), say).home).toBe('500 → <delivery-pricing.csv-inherit>');
  });

  it('shows at most the preview row cap, saying how many more there are', () => {
    // Arrange
    const changes = Array.from({ length: 205 }, (_, index) => change({ codeOns: index }));

    // Act
    const shown = shownChangesOf(changes);

    // Assert
    expect(shown).toMatchObject({ rows: changes.slice(0, 200), hidden: 5 });
  });

  it('names a refused row by its stable reason', () => {
    expect(csvIssueMessageIdOf('commune-not-in-wilaya')).toBe('delivery-pricing.csv-issue-commune-not-in-wilaya');
  });
});
