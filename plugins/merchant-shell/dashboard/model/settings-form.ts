import type { SoldOutBehavior } from '@cod/shared';
import type { BusinessRecord, StoreRecord } from './types';

/** What the Business card edits. */
export interface BusinessDraft {
  readonly name: string;
  readonly logoAssetId: string | null;
}

/** What the Store card edits. */
export interface StoreDraft {
  readonly name: string;
  readonly description: string;
  readonly language: string;
  readonly logoAssetId: string | null;
  readonly showAddressField: boolean;
  readonly soldOutBehavior: SoldOutBehavior;
}

/** The fields {@link businessPatchOf} may send, mirroring `UpdateBusinessInput`. */
export type BusinessPatch = Partial<BusinessDraft>;

/** The fields {@link storePatchOf} may send, mirroring `UpdateStoreInput`. */
export type StorePatch = Partial<StoreDraft>;

export const draftOfBusiness = ({ name, logoAssetId }: BusinessRecord): BusinessDraft => ({ name, logoAssetId });

export const draftOfStore = ({
  name,
  description,
  language,
  logoAssetId,
  showAddressField,
  soldOutBehavior,
}: StoreRecord): StoreDraft => ({ name, description, language, logoAssetId, showAddressField, soldOutBehavior });

/** The draft with the name trimmed, as it is saved. */
export const trimmed = <T extends { readonly name: string }>(draft: T): T => ({ ...draft, name: draft.name.trim() });

/** The keys of `next` whose values differ from `saved`, with `next`'s values. */
function changedFields<T extends object>(next: T, saved: T): Partial<T> {
  const savedValues = new Map<string, unknown>(Object.entries(saved));
  return Object.fromEntries(
    Object.entries(next).filter(([field, value]) => value !== savedValues.get(field)),
  ) as Partial<T>;
}

/** Only the fields that differ from what is saved, so a save never rewrites what the merchant did not touch. */
export function storePatchOf(draft: StoreDraft, saved: StoreDraft): StorePatch {
  return changedFields(trimmed(draft), saved);
}

/** Only the business fields that differ from what is saved: a new logo, a new (trimmed) name, or both. */
export function businessPatchOf(draft: BusinessDraft, saved: BusinessDraft): BusinessPatch {
  return changedFields(trimmed(draft), saved);
}

/**
 * Whether Save is offered: something changed and the name is not blank. Feedback only; the server validates the name
 * and the language again and answers with a code (ADR 0017).
 */
export function canSaveStore(draft: StoreDraft, saved: StoreDraft): boolean {
  return draft.name.trim() !== '' && Object.keys(storePatchOf(draft, saved)).length > 0;
}

/** Whether Save is offered on the Business card: something changed and the name is not blank. */
export function canSaveBusiness(draft: BusinessDraft, saved: BusinessDraft): boolean {
  return draft.name.trim() !== '' && Object.keys(businessPatchOf(draft, saved)).length > 0;
}
