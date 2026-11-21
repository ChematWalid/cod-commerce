import { randomInt } from 'node:crypto';
import type { RandomCodeSource } from '../domain/ports/random-code-source.port';

/** Generated codes drawn from the operating system's CSPRNG (D2512): a code must not be guessable from another. */
export class CryptoCodeSource implements RandomCodeSource {
  next(alphabet: string, length: number): string {
    return Array.from({ length }, () => alphabet.charAt(randomInt(alphabet.length))).join('');
  }
}
