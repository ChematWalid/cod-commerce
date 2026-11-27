import { WILAYA_COUNT, WILAYAS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  deliversEverywhere,
  deskEverywhere,
  withApplyToAll,
  withDeliverEverywhere,
  withDeskEverywhere,
} from '../../dashboard/model/pricing-bulk';
import {
  newPricingFormOf,
  type PricingForm,
  pricingFormOf,
  rowOverridden,
  withRow,
  withRowReset,
} from '../../dashboard/model/pricing-form';
import { pricingInputOf } from '../../dashboard/model/pricing-input';
import { FIXTURE_BASE_DESK, FIXTURE_BASE_HOME, groupOf, rateOf } from '../support/dashboard-fixtures';

const rowOf = (form: PricingForm, code: string) => form.rows.find((row) => row.provinceCode === code);
/** The row of `code`, which every form of the fixtures holds. */
function requiredRow(form: PricingForm, code: string) {
  const row = rowOf(form, code);
  if (row === undefined) throw new Error(`no row ${code}`);
  return row;
}

describe('pricing option form', () => {
  it('has one row per wilaya of WILAYAS, in code order, with the effective prices of an edited group', () => {
    // Arrange
    const group = groupOf({ isPlatformDefault: false, name: 'Express' }, [
      rateOf('16', { homePrice: 450, overridden: true, deskEnabled: false }),
    ]);

    // Act
    const form = pricingFormOf(group);

    // Assert
    expect(form.rows).toHaveLength(WILAYA_COUNT);
    expect(form.rows.map((row) => row.provinceCode)).toEqual(WILAYAS.map(({ code }) => code));
    expect(form.name).toBe('Express');
    expect(rowOf(form, '16')).toMatchObject({
      homePrice: '450',
      deskPrice: String(FIXTURE_BASE_DESK),
      deskEnabled: false,
    });
  });

  it('starts a new option from the template table at its base prices, with no name and no override', () => {
    // Arrange
    const template = groupOf({ chargeOverweight: true, overweightAllowanceKg: 3, overweightRate: 80 }, [
      rateOf('31', { homePrice: 300, overridden: true }),
    ]);

    // Act
    const form = newPricingFormOf(template);

    // Assert
    expect(form.name).toBe('');
    expect(form.carrierId).toBeNull();
    expect(form).toMatchObject({ chargeOverweight: true, overweightAllowanceKg: '3', overweightRate: '80' });
    expect(rowOf(form, '31')?.homePrice).toBe(String(FIXTURE_BASE_HOME));
    expect(form.rows.some(rowOverridden)).toBe(false);
  });

  it('marks a row whose typed price differs from its base, and reset brings back the base prices', () => {
    // Arrange
    const form = withRow(pricingFormOf(groupOf()), '05', { homePrice: '999', deskPrice: '1' });

    // Act
    const marked = rowOverridden(requiredRow(form, '05'));
    const reset = withRowReset(form, '05');

    // Assert
    expect(marked).toBe(true);
    expect(rowOf(reset, '05')).toMatchObject({
      homePrice: String(FIXTURE_BASE_HOME),
      deskPrice: String(FIXTURE_BASE_DESK),
    });
    expect(rowOverridden(requiredRow(reset, '05'))).toBe(false);
  });
});

describe('Apply to all and the master toggles', () => {
  it('applies the home and desk prices typed to every row, leaving a blank one as it was', () => {
    // Arrange
    const form = pricingFormOf(groupOf());

    // Act
    const both = withApplyToAll(form, { home: '650', desk: '350' });
    const homeOnly = withApplyToAll(form, { home: '600', desk: ' ' });

    // Assert
    expect(both.rows.every((row) => row.homePrice === '650' && row.deskPrice === '350')).toBe(true);
    expect(homeOnly.rows.every((row) => row.homePrice === '600')).toBe(true);
    expect(homeOnly.rows.every((row) => row.deskPrice === String(FIXTURE_BASE_DESK))).toBe(true);
  });

  it('"Deliver to every wilaya" switches every row on or off and reads on only when all are on', () => {
    // Arrange
    const form = withRow(pricingFormOf(groupOf()), '10', { deliveryEnabled: false });

    // Act
    const partly = deliversEverywhere(form);
    const allOn = withDeliverEverywhere(form, true);
    const allOff = withDeliverEverywhere(form, false);

    // Assert
    expect(partly).toBe(false);
    expect(deliversEverywhere(allOn)).toBe(true);
    expect(allOff.rows.every((row) => !row.deliveryEnabled)).toBe(true);
  });

  it('"Stop desk in every delivered wilaya" turns the desk on only where delivery is on, and off everywhere', () => {
    // Arrange
    const noDesk = withDeskEverywhere(pricingFormOf(groupOf()), false);
    const form = withRow(noDesk, '10', { deliveryEnabled: false });

    // Act
    const on = withDeskEverywhere(form, true);

    // Assert
    expect(deskEverywhere(noDesk)).toBe(false);
    expect(rowOf(on, '10')?.deskEnabled).toBe(false);
    expect(on.rows.filter((row) => row.deliveryEnabled).every((row) => row.deskEnabled)).toBe(true);
    expect(deskEverywhere(on)).toBe(true);
    expect(deskEverywhere(withDeliverEverywhere(on, false))).toBe(false);
  });
});

describe('pricing option input', () => {
  it('sends the name, the settings and one numeric rate per wilaya', () => {
    // Arrange
    const form = { ...withApplyToAll(newPricingFormOf(groupOf()), { home: '800', desk: '' }), name: ' Express ' };

    // Act
    const submit = pricingInputOf(form);

    // Assert
    expect(submit.ok).toBe(true);
    if (!submit.ok) return;
    expect(submit.input.name).toBe('Express');
    expect(submit.input.rates).toHaveLength(WILAYA_COUNT);
    expect(submit.input.rates[0]).toEqual({
      provinceCode: '01',
      homePrice: 800,
      deskPrice: FIXTURE_BASE_DESK,
      deliveryEnabled: true,
      deskEnabled: true,
    });
  });

  it('refuses a blank name, a non-numeric allowance and a broken price, naming each field', () => {
    // Arrange
    const form = withRow({ ...newPricingFormOf(groupOf()), name: '  ', overweightAllowanceKg: 'five' }, '16', {
      homePrice: '12.5',
    });

    // Act
    const submit = pricingInputOf(form);

    // Assert
    expect(submit.ok).toBe(false);
    if (submit.ok) return;
    expect([...submit.errors].sort()).toEqual(['name', 'overweightAllowanceKg', 'rate:16']);
  });
});
