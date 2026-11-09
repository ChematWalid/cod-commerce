import { BadRequestException } from '@nestjs/common';

/** The named string fields of a JSON body. @throws BadRequestException naming the fields, never their values. */
export function stringFields<K extends string>(body: unknown, ...names: readonly K[]): Record<K, string> {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (!names.every((name) => typeof record[name] === 'string')) {
    throw new BadRequestException(`${names.join(', ')} required`);
  }
  return record as Record<K, string>;
}
