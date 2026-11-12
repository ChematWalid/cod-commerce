import {
  COMMISSION_BASES,
  COMMISSION_FIXED_MAX_DZD,
  COMMISSION_PERCENT_MAX_BPS,
  type CommissionBasis,
  type CommissionConfigInput,
  type CommissionValueKind,
} from '@cod/shared';

/** The inline "new commission" form of the invite dialog; the value is the text as typed. */
export interface CommissionDraft {
  readonly name: string;
  readonly basis: CommissionBasis;
  readonly valueKind: CommissionValueKind;
  readonly value: string;
}

/** Basis points in one percent. */
const BPS_PER_PERCENT = 100;
const WHOLE_NUMBER = /^\d+$/;
/** A percent with at most two decimals, the precision of basis points. */
const PERCENT = /^\d+(?:\.\d{1,2})?$/;

export function emptyCommissionDraft(): CommissionDraft {
  return { name: '', basis: COMMISSION_BASES[0], valueKind: 'fixed', value: '' };
}

/** The stored value: whole DZD for a fixed commission, basis points for a percent; null when out of range. */
export function commissionValueOf(kind: CommissionValueKind, text: string): number | null {
  const trimmed = text.trim();
  const pattern = kind === 'fixed' ? WHOLE_NUMBER : PERCENT;
  if (!pattern.test(trimmed)) return null;
  const value = kind === 'fixed' ? Number(trimmed) : Math.round(Number(trimmed) * BPS_PER_PERCENT);
  const cap = kind === 'fixed' ? COMMISSION_FIXED_MAX_DZD : COMMISSION_PERCENT_MAX_BPS;
  return value > 0 && value <= cap ? value : null;
}

/** The `createTeamCommissionConfig` input of a valid draft, for every store; null while it has gaps. */
export function commissionInputOf(draft: CommissionDraft): CommissionConfigInput | null {
  const value = commissionValueOf(draft.valueKind, draft.value);
  const name = draft.name.trim();
  if (value === null || name === '') return null;
  return { name, basis: draft.basis, valueKind: draft.valueKind, value, scope: 'all' };
}

/** A stored value as the form shows it: DZD, or a percent from its basis points. */
export function commissionValueText(kind: CommissionValueKind, value: number): string {
  return kind === 'fixed' ? String(value) : String(value / BPS_PER_PERCENT);
}
