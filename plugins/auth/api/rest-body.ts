import { BadRequestException } from '@nestjs/common';
import type { ProfileUpdate } from '../application/account-profile.service';

/** The named string fields of a JSON body. @throws BadRequestException naming the fields, never their values. */
export function stringFields<K extends string>(body: unknown, ...names: readonly K[]): Record<K, string> {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (!names.every((name) => typeof record[name] === 'string')) {
    throw new BadRequestException(`${names.join(', ')} required`);
  }
  return record as Record<K, string>;
}

const PROFILE_FIELDS = ['firstName', 'lastName', 'phone'] as const;

/**
 * The profile fields of a JSON body that are present. A value of the wrong type is passed on as sent, so the
 * shared schema refuses it by field name; `phone: null` clears the phone.
 */
export function optionalProfileFields(body: unknown): ProfileUpdate {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return Object.fromEntries(PROFILE_FIELDS.filter((name) => name in record).map((name) => [name, record[name]]));
}
