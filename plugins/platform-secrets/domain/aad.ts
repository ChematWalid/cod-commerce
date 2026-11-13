import { DATA_KEY_AAD_LABEL, SECRET_AAD_LABEL } from './constants';

/**
 * The additional authenticated data of a wrapped data key: `tenant-data-key\n{businessId}\n{kid}`. A key row copied
 * to another business, or relabelled with another kid, no longer opens (D114).
 */
export function dataKeyAad(businessId: string, kid: string): Buffer {
  return Buffer.from(`${DATA_KEY_AAD_LABEL}\n${businessId}\n${kid}`, 'utf8');
}

/**
 * The additional authenticated data of a value: `tenant-secret\n{businessId}\n{provider}\n{ref}`. A row copied to
 * another business, provider or ref no longer opens (D114).
 */
export function secretAad(businessId: string, provider: string, ref: string): Buffer {
  return Buffer.from(`${SECRET_AAD_LABEL}\n${businessId}\n${provider}\n${ref}`, 'utf8');
}
