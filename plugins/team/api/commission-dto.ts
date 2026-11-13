import type { CommissionBasis } from '@cod/shared';
import type { CommissionConfig } from '../domain/commission-config';
import ar from './i18n/ar.json';
import en from './i18n/en.json';

/** A commission config as both API surfaces send it; the business and the comparison key stay inside. */
export type CommissionConfigDto = Omit<CommissionConfig, 'businessId' | 'nameKey'>;

/** The wire form of a commission config. */
export function toCommissionConfigDto(config: CommissionConfig): CommissionConfigDto {
  const { id, name, basis, valueKind, value, scope, storeIds, createdAt, updatedAt } = config;
  return { id, name, basis, valueKind, value, scope, storeIds, createdAt, updatedAt };
}

/** A basis a commission can be earned on, with its label in each dashboard language. */
export interface CommissionBasisOptionDto {
  readonly basis: CommissionBasis;
  readonly labels: { readonly ar: string; readonly en: string };
}

/** The wire form of a basis, labelled from the plugin's `api/i18n` files. */
export function toCommissionBasisOptionDto(basis: CommissionBasis): CommissionBasisOptionDto {
  return { basis, labels: { ar: ar['commission-basis'][basis], en: en['commission-basis'][basis] } };
}
