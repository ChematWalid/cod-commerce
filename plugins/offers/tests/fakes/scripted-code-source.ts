import type { RandomCodeSource } from '../../domain/ports/random-code-source.port';

/**
 * A random source that hands out its `queued` draws first, then distinct ones counted in the alphabet, so a test
 * decides which draws collide.
 */
export class ScriptedCodeSource implements RandomCodeSource {
  private drawn = 0;

  constructor(private readonly queued: string[] = []) {}

  next(alphabet: string, length: number): string {
    const scripted = this.queued.shift();
    if (scripted !== undefined) return scripted;
    this.drawn += 1;
    return countedIn(alphabet, this.drawn).padStart(length, alphabet.charAt(0));
  }
}

/** A source that always draws `value`: every round collides once `value` is taken. */
export const stuckCodeSource = (value: string): RandomCodeSource => ({ next: () => value });

/** `count` written in `alphabet` as its digits. */
function countedIn(alphabet: string, count: number): string {
  let digits = '';
  for (let rest = count; rest > 0; rest = Math.floor(rest / alphabet.length)) {
    digits = alphabet.charAt(rest % alphabet.length) + digits;
  }
  return digits;
}
