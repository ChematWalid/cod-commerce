import type { Note } from '../domain/note';

/** A note as the Admin API returns it (`TemplateNote`): no `businessId`, the id as a decimal string. */
export interface TemplateNoteDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: Date;
}

/** The arguments of `templateNote`. */
export interface TemplateNoteArgs {
  readonly id: string;
}

/** The arguments of `templateNotes`; GraphQL passes `null` for an explicit null. */
export interface TemplateNotesArgs {
  readonly take?: number | null;
  readonly skip?: number | null;
}

/** The arguments of `createTemplateNote`. */
export interface CreateTemplateNoteArgs {
  readonly input: { readonly title: string; readonly body: string };
}

/** Maps a domain note to its API shape. */
export function toTemplateNoteDto(note: Note): TemplateNoteDto {
  return { id: note.id, title: note.title.value, body: note.body, createdAt: note.createdAt };
}
