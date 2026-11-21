import { GENERATED_CODE_ALPHABET, GENERATED_CODE_LENGTH } from '@cod/shared';
import type { RandomCodeSource } from './ports/random-code-source.port';

/** What one round of generated codes asks for: how many, behind which prefix. */
export interface CodeBatchRequest {
  readonly prefix: string;
  readonly count: number;
}

/**
 * One round of generated codes (D2512): `count` draws of the random part behind `prefix`, keeping each candidate
 * once and dropping those in `exclude` (codes kept or refused already), so a round may give fewer than `count`.
 */
export function assembleCodes(
  source: RandomCodeSource,
  { prefix, count }: CodeBatchRequest,
  exclude: ReadonlySet<string>,
): string[] {
  const codes = new Set<string>();
  for (let draw = 0; draw < count; draw += 1) {
    const code = prefix + source.next(GENERATED_CODE_ALPHABET, GENERATED_CODE_LENGTH);
    if (!exclude.has(code)) codes.add(code);
  }
  return [...codes];
}
