import type { BusinessRecord, StoreRecord } from './types';

/** What the Business card edits. */
export interface BusinessDraft {
  readonly name: string;
}

/** What the Store card edits. */
export interface StoreDraft {
  readonly name: string;
  readonly description: string;
  readonly language: string;
}

/** The fields {@link storePatchOf} may send, mirroring `UpdateStoreInput`. */
export type StorePatch = Partial<StoreDraft>;

export const draftOfBusiness = ({ name }: BusinessRecord): BusinessDraft => ({ name });

export const draftOfStore = ({ name, description, language }: StoreRecord): StoreDraft => ({
  name,
  description,
  language,
});

/** The draft with the name trimmed, as it is saved. */
export const trimmed = <T extends { readonly name: string }>(draft: T): T => ({ ...draft, name: draft.name.trim() });

/** Only the fields that differ from what is saved, so a save never rewrites what the merchant did not touch. */
export function storePatchOf(draft: StoreDraft, saved: StoreDraft): StorePatch {
  const next = trimmed(draft);
  const patch: { -readonly [K in keyof StoreDraft]?: StoreDraft[K] } = {};
  if (next.name !== saved.name) patch.name = next.name;
  if (next.description !== saved.description) patch.description = next.description;
  if (next.language !== saved.language) patch.language = next.language;
  return patch;
}

/**
 * Whether Save is offered: something changed and the name is not blank. Feedback only; the server validates the name
 * and the language again and answers with a code (ADR 0017).
 */
export function canSaveStore(draft: StoreDraft, saved: StoreDraft): boolean {
  return draft.name.trim() !== '' && Object.keys(storePatchOf(draft, saved)).length > 0;
}

/** Whether Save is offered on the Business card. */
export function canSaveBusiness(draft: BusinessDraft, saved: BusinessDraft): boolean {
  return draft.name.trim() !== '' && draft.name.trim() !== saved.name;
}
