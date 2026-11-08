import { type NoteId, toNoteId } from '../../domain/note';
import type { IdGeneratorPort } from '../../domain/ports/id-generator.port';

/** Hands out `first`, `first + 1`, …, so a test knows every id in advance. */
export class SequentialIdGenerator implements IdGeneratorPort {
  private upcoming: bigint;

  constructor(first: string) {
    this.upcoming = BigInt(first);
  }

  next(): NoteId {
    const id = toNoteId(this.upcoming.toString());
    this.upcoming += 1n;
    return id;
  }
}
